import { errorResponse, successResponse } from '../../utils/response.ts';

export async function handleListLearnerLessons(env: Env, origin: string, userId: string, courseId: string): Promise<Response> {
  const { results } = await env.DB.prepare(`
    SELECT ll.*, l.title as lesson_title, l.chapter_title
    FROM learner_lessons ll
    JOIN lessons l ON l.id = ll.lesson_id
    WHERE ll.user_id = ? AND ll.course_id = ?
    ORDER BY ll.updated_at DESC
  `).bind(userId, courseId).all();

  return successResponse(200, 'SUCCESS', results ?? [], origin);
}

export async function handleSaveLessonProgress(
  request: Request,
  env: Env,
  origin: string,
  userId: string,
  lessonId: string
): Promise<Response> {
  const lesson = await env.DB.prepare('SELECT id, course_id FROM lessons WHERE id = ?').bind(lessonId).first<{ id: string; course_id: string }>();
  if (!lesson) return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy bài học', origin);

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const status = body?.status === 'completed' ? 'completed' : 'in_progress';
  const score = typeof body?.score === 'number' ? body.score : 0;
  const stars = typeof body?.stars === 'number' ? Math.min(3, Math.max(0, body.stars)) : 0;

  const now = Date.now();
  const completedAt = status === 'completed' ? now : null;

  // 1. Lưu hoặc cập nhật tiến độ bài học
  await env.DB.prepare(`
    INSERT INTO learner_lessons (user_id, lesson_id, course_id, status, score, stars, completed_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, lesson_id) DO UPDATE SET
      status = excluded.status,
      score = MAX(learner_lessons.score, excluded.score),
      stars = MAX(learner_lessons.stars, excluded.stars),
      completed_at = COALESCE(learner_lessons.completed_at, excluded.completed_at),
      updated_at = excluded.updated_at
  `).bind(userId, lessonId, lesson.course_id, status, score, stars, completedAt, now, now).run();

  // 2. Cập nhật last_lesson_id trong learner_courses
  await env.DB.prepare(`
    INSERT INTO learner_courses (user_id, course_id, status, last_lesson_id, enrolled_at, updated_at)
    VALUES (?, ?, 'enrolled', ?, ?, ?)
    ON CONFLICT(user_id, course_id) DO UPDATE SET
      last_lesson_id = excluded.last_lesson_id,
      updated_at = excluded.updated_at
  `).bind(userId, lesson.course_id, lessonId, now, now).run();

  const record = await env.DB.prepare('SELECT * FROM learner_lessons WHERE user_id = ? AND lesson_id = ?').bind(userId, lessonId).first();
  return successResponse(200, 'SUCCESS', record, origin);
}
