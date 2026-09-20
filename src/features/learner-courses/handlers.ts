import { errorResponse, successResponse } from '../../utils/response.ts';

export async function handleListMyCourses(
  request: Request,
  env: Env,
  origin: string,
  userId: number,
  profileId?: number | null
): Promise<Response> {
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const targetProfileId = profileId ?? null;

  if (!targetProfileId) {
    return successResponse(200, 'SUCCESS', [], origin);
  }

  let query = `
    SELECT 
      c.*,
      lc.status as enrollment_status,
      lc.score as learner_score,
      lc.meta as learner_meta,
      lc.last_lesson_id,
      lc.enrolled_at,
      lc.updated_at as last_studied_at,
      (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id AND l.status = 'published') as total_lessons,
      (SELECT COUNT(*) FROM learner_lessons ll WHERE ll.course_id = c.id AND ll.profile_id = ? AND ll.status = 'completed') as completed_lessons
    FROM learner_courses lc
    JOIN courses c ON c.id = lc.course_id
    WHERE lc.profile_id = ?
  `;

  const params: unknown[] = [targetProfileId, targetProfileId];
  if (status) {
    query += ' AND lc.status = ?';
    params.push(status);
  }

  query += ' ORDER BY lc.updated_at DESC';

  const { results } = await env.DB.prepare(query).bind(...params).all();
  return successResponse(200, 'SUCCESS', results ?? [], origin);
}

export async function handleEnrollCourse(
  request: Request,
  env: Env,
  origin: string,
  userId: number,
  courseIdOrSlug: string,
  profileId?: number | null
): Promise<Response> {
  const courseIdNum = Number.parseInt(courseIdOrSlug, 10);
  const course = await env.DB.prepare(
    !Number.isNaN(courseIdNum) ? 'SELECT id FROM courses WHERE id = ? OR slug = ?' : 'SELECT id FROM courses WHERE slug = ?'
  ).bind(!Number.isNaN(courseIdNum) ? courseIdNum : courseIdOrSlug, courseIdOrSlug).first<{ id: number }>();

  if (!course) return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy khoá học', origin);

  const targetProfileId = profileId ?? null;
  if (!targetProfileId) {
    return errorResponse(400, 'BAD_REQUEST', 'Vui lòng chỉ định hồ sơ học sinh (?profile_id=...) trước khi đăng ký khoá học', origin);
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const status = body?.status === 'favorite' ? 'favorite' : body?.status === 'completed' ? 'completed' : 'enrolled';
  const score = typeof body?.score === 'number' ? body.score : 0;
  
  let metaString: string | null = null;
  if (body?.meta !== undefined && body?.meta !== null) {
    metaString = typeof body.meta === 'string' ? body.meta : JSON.stringify(body.meta);
  }

  const now = Date.now();

  await env.DB.prepare(`
    INSERT INTO learner_courses (profile_id, user_id, course_id, status, score, meta, enrolled_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(profile_id, course_id) DO UPDATE SET
      status = excluded.status,
      score = MAX(learner_courses.score, excluded.score),
      meta = COALESCE(excluded.meta, learner_courses.meta),
      updated_at = excluded.updated_at
  `).bind(targetProfileId, userId, course.id, status, score, metaString, now, now).run();

  const record = await env.DB.prepare(`
    SELECT lc.*, c.title, c.slug 
    FROM learner_courses lc
    JOIN courses c ON c.id = lc.course_id
    WHERE lc.profile_id = ? AND lc.course_id = ?
  `).bind(targetProfileId, course.id).first();

  return successResponse(200, 'SUCCESS', record, origin);
}

export async function handleUnenrollCourse(
  request: Request,
  env: Env,
  origin: string,
  userId: number,
  courseIdOrSlug: string,
  profileId?: number | null
): Promise<Response> {
  const targetProfileId = profileId ?? null;

  if (!targetProfileId) {
    return errorResponse(400, 'BAD_REQUEST', 'Vui lòng chỉ định hồ sơ học sinh (?profile_id=...)', origin);
  }

  const courseIdNum = Number.parseInt(courseIdOrSlug, 10);
  const course = await env.DB.prepare(
    !Number.isNaN(courseIdNum) ? 'SELECT id FROM courses WHERE id = ? OR slug = ?' : 'SELECT id FROM courses WHERE slug = ?'
  ).bind(!Number.isNaN(courseIdNum) ? courseIdNum : courseIdOrSlug, courseIdOrSlug).first<{ id: number }>();

  if (!course) return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy khoá học', origin);

  await env.DB.prepare('DELETE FROM learner_courses WHERE profile_id = ? AND course_id = ?')
    .bind(targetProfileId, course.id).run();

  return successResponse(200, 'DELETED', { course_id: course.id, profile_id: targetProfileId }, origin);
}
