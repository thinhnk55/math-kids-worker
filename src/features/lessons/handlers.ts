import { errorResponse, successResponse } from '../../utils/response.ts';
import { generateUUIDv7 } from '../../utils/uuid.ts';

export async function handleListLessons(env: Env, origin: string, courseId: string, userId?: string): Promise<Response> {
  let query = 'SELECT l.*';
  if (userId) {
    query += `,
      (SELECT ll.status FROM learner_lessons ll WHERE ll.lesson_id = l.id AND ll.user_id = '${userId}') as learner_status,
      (SELECT ll.stars FROM learner_lessons ll WHERE ll.lesson_id = l.id AND ll.user_id = '${userId}') as stars
    `;
  }
  query += ' FROM lessons l WHERE l.course_id = ? AND l.status = \'published\' ORDER BY l.sort_order ASC, l.created_at ASC';

  const { results } = await env.DB.prepare(query).bind(courseId).all();
  return successResponse(200, 'SUCCESS', results ?? [], origin);
}

export async function handleGetLesson(env: Env, origin: string, lessonId: string, userId?: string): Promise<Response> {
  let query = 'SELECT l.*';
  if (userId) {
    query += `,
      (SELECT ll.status FROM learner_lessons ll WHERE ll.lesson_id = l.id AND ll.user_id = '${userId}') as learner_status,
      (SELECT ll.score FROM learner_lessons ll WHERE ll.lesson_id = l.id AND ll.user_id = '${userId}') as score,
      (SELECT ll.stars FROM learner_lessons ll WHERE ll.lesson_id = l.id AND ll.user_id = '${userId}') as stars
    `;
  }
  query += ' FROM lessons l WHERE l.id = ? LIMIT 1';

  const lesson = await env.DB.prepare(query).bind(lessonId).first();
  if (!lesson) return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy bài học', origin);

  return successResponse(200, 'SUCCESS', lesson, origin);
}

export async function handleCreateLesson(request: Request, env: Env, origin: string, courseId: string): Promise<Response> {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || !body.title) {
    return errorResponse(400, 'VALIDATION_ERROR', 'title là bắt buộc', origin);
  }

  const id = generateUUIDv7();
  const now = Date.now();

  try {
    await env.DB.prepare(`
      INSERT INTO lessons (id, course_id, chapter_title, title, duration_minutes, sort_order, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      courseId,
      body.chapter_title ? String(body.chapter_title).trim() : 'Chương 1',
      String(body.title).trim(),
      typeof body.duration_minutes === 'number' ? body.duration_minutes : 15,
      typeof body.sort_order === 'number' ? body.sort_order : 0,
      body.status ? String(body.status).trim() : 'published',
      now,
      now
    ).run();

    const created = await env.DB.prepare('SELECT * FROM lessons WHERE id = ?').bind(id).first();
    return successResponse(201, 'CREATED', created, origin);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(500, 'INTERNAL_ERROR', message, origin);
  }
}
