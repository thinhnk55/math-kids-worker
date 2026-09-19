import { errorResponse, successResponse } from '../../utils/response.ts';

export async function handleListMyCourses(request: Request, env: Env, origin: string, userId: string): Promise<Response> {
  const url = new URL(request.url);
  const status = url.searchParams.get('status'); // 'enrolled' | 'favorite' | 'completed'

  let query = `
    SELECT 
      c.*,
      lc.status as enrollment_status,
      lc.last_lesson_id,
      lc.enrolled_at,
      lc.updated_at as last_studied_at,
      (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id AND l.status = 'published') as total_lessons,
      (SELECT COUNT(*) FROM learner_lessons ll WHERE ll.course_id = c.id AND ll.user_id = ? AND ll.status = 'completed') as completed_lessons
    FROM learner_courses lc
    JOIN courses c ON c.id = lc.course_id
    WHERE lc.user_id = ?
  `;

  const params: unknown[] = [userId, userId];
  if (status) {
    query += ' AND lc.status = ?';
    params.push(status);
  }

  query += ' ORDER BY lc.updated_at DESC';

  const { results } = await env.DB.prepare(query).bind(...params).all();
  return successResponse(200, 'SUCCESS', results ?? [], origin);
}

export async function handleEnrollCourse(request: Request, env: Env, origin: string, userId: string, courseId: string): Promise<Response> {
  const course = await env.DB.prepare('SELECT id FROM courses WHERE id = ?').bind(courseId).first();
  if (!course) return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy khoá học', origin);

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const status = body?.status === 'favorite' ? 'favorite' : 'enrolled';
  const now = Date.now();

  await env.DB.prepare(`
    INSERT INTO learner_courses (user_id, course_id, status, enrolled_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, course_id) DO UPDATE SET
      status = excluded.status,
      updated_at = excluded.updated_at
  `).bind(userId, courseId, status, now, now).run();

  const record = await env.DB.prepare(`
    SELECT lc.*, c.title, c.slug 
    FROM learner_courses lc
    JOIN courses c ON c.id = lc.course_id
    WHERE lc.user_id = ? AND lc.course_id = ?
  `).bind(userId, courseId).first();

  return successResponse(200, 'SUCCESS', record, origin);
}

export async function handleUnenrollCourse(env: Env, origin: string, userId: string, courseId: string): Promise<Response> {
  await env.DB.prepare('DELETE FROM learner_courses WHERE user_id = ? AND course_id = ?').bind(userId, courseId).run();
  return successResponse(200, 'DELETED', { course_id: courseId }, origin);
}
