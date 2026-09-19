import { resolveProfileId } from '../../utils/profile.ts';
import { errorResponse, successResponse } from '../../utils/response.ts';

export async function handleListLearnerLessons(
  request: Request,
  env: Env,
  origin: string,
  userId: number,
  courseId: string,
  profileIdHeader?: string | null
): Promise<Response> {
  const url = new URL(request.url);
  const targetProfileId = await resolveProfileId(env, userId, url.searchParams.get('profile_id') || profileIdHeader);

  if (!targetProfileId) {
    return successResponse(200, 'SUCCESS', [], origin);
  }

  const { results } = await env.DB.prepare(`
    SELECT ll.*, l.title as lesson_title
    FROM learner_lessons ll
    JOIN lessons l ON l.id = ll.lesson_id
    WHERE ll.profile_id = ? AND ll.course_id = ?
    ORDER BY ll.updated_at DESC
  `).bind(targetProfileId, courseId).all();

  return successResponse(200, 'SUCCESS', results ?? [], origin);
}

export async function handleSaveLessonProgress(
  request: Request,
  env: Env,
  origin: string,
  userId: number,
  lessonId: string,
  profileIdHeader?: string | null
): Promise<Response> {
  const lesson = await env.DB.prepare('SELECT id, course_id, sort_order, created_at FROM lessons WHERE id = ?')
    .bind(lessonId).first<{ id: string; course_id: string; sort_order: number; created_at: number }>();
  if (!lesson) return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy bài học', origin);

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const status = body?.status === 'completed' ? 'completed' : 'in_progress';
  const score = typeof body?.score === 'number' ? body.score : 0;
  const stars = typeof body?.stars === 'number' ? Math.min(3, Math.max(0, body.stars)) : 0;

  const targetProfileId = await resolveProfileId(env, userId, (body?.profile_id as string | number) || profileIdHeader);
  if (!targetProfileId) {
    return errorResponse(400, 'BAD_REQUEST', 'Vui lòng tạo hồ sơ học sinh trước khi lưu tiến độ', origin);
  }

  // Kiểm tra tính tuần tự: Tìm bài học liền kề trước bài này trong cùng khoá học
  const prevLesson = await env.DB.prepare(`
    SELECT id FROM lessons 
    WHERE course_id = ? AND status = 'published'
      AND (sort_order < ? OR (sort_order = ? AND created_at < ?))
    ORDER BY sort_order DESC, created_at DESC 
    LIMIT 1
  `).bind(lesson.course_id, lesson.sort_order, lesson.sort_order, lesson.created_at).first<{ id: string }>();

  if (prevLesson) {
    // Kiểm tra xem bài trước đã hoàn thành chưa
    const prevProgress = await env.DB.prepare(`
      SELECT status FROM learner_lessons 
      WHERE profile_id = ? AND lesson_id = ?
    `).bind(targetProfileId, prevLesson.id).first<{ status: string }>();

    if (!prevProgress || prevProgress.status !== 'completed') {
      return errorResponse(403, 'FORBIDDEN', 'Bạn cần hoàn thành bài học trước đó trước khi học bài này', origin);
    }
  }

  const now = Date.now();
  const completedAt = status === 'completed' ? now : null;

  // 1. Lưu hoặc cập nhật tiến độ bài học của profile
  await env.DB.prepare(`
    INSERT INTO learner_lessons (profile_id, user_id, lesson_id, course_id, status, score, stars, completed_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(profile_id, lesson_id) DO UPDATE SET
      status = excluded.status,
      score = MAX(learner_lessons.score, excluded.score),
      stars = MAX(learner_lessons.stars, excluded.stars),
      completed_at = COALESCE(learner_lessons.completed_at, excluded.completed_at),
      updated_at = excluded.updated_at
  `).bind(targetProfileId, userId, lessonId, lesson.course_id, status, score, stars, completedAt, now, now).run();

  // 2. Cập nhật last_lesson_id trong learner_courses của profile
  await env.DB.prepare(`
    INSERT INTO learner_courses (profile_id, user_id, course_id, status, last_lesson_id, enrolled_at, updated_at)
    VALUES (?, ?, ?, 'enrolled', ?, ?, ?)
    ON CONFLICT(profile_id, course_id) DO UPDATE SET
      last_lesson_id = excluded.last_lesson_id,
      updated_at = excluded.updated_at
  `).bind(targetProfileId, userId, lesson.course_id, lessonId, now, now).run();

  const record = await env.DB.prepare('SELECT * FROM learner_lessons WHERE profile_id = ? AND lesson_id = ?')
    .bind(targetProfileId, lessonId).first();

  return successResponse(200, 'SUCCESS', record, origin);
}
