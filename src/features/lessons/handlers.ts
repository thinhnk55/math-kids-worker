import { resolveProfileId } from '../../utils/profile.ts';
import { errorResponse, successResponse } from '../../utils/response.ts';

export async function handleListLessons(
  request: Request,
  env: Env,
  origin: string,
  courseId: string,
  userId?: number,
  profileIdHeader?: string | null
): Promise<Response> {
  const url = new URL(request.url);
  const targetProfileId = userId ? await resolveProfileId(env, userId, url.searchParams.get('profile_id') || profileIdHeader) : null;
  const courseIdNum = Number.parseInt(courseId, 10);

  let query = 'SELECT l.*';
  if (targetProfileId) {
    query += `,
      (SELECT ll.status FROM learner_lessons ll WHERE ll.lesson_id = l.id AND ll.profile_id = ${targetProfileId}) as learner_status,
      (SELECT ll.score FROM learner_lessons ll WHERE ll.lesson_id = l.id AND ll.profile_id = ${targetProfileId}) as score,
      (SELECT ll.meta FROM learner_lessons ll WHERE ll.lesson_id = l.id AND ll.profile_id = ${targetProfileId}) as learner_meta
    `;
  }
  query += ' FROM lessons l WHERE l.course_id = ? AND l.status = \'published\' ORDER BY l.sort_order ASC, l.created_at ASC';

  const { results } = await env.DB.prepare(query).bind(!Number.isNaN(courseIdNum) ? courseIdNum : courseId).all();
  const rawLessons = (results ?? []) as Array<Record<string, unknown>>;

  let prevLessonCompleted = true;
  const lessons = rawLessons.map((item, index) => {
    const isCompleted = item.learner_status === 'completed';
    const isLocked = index === 0 ? false : !prevLessonCompleted;
    prevLessonCompleted = isCompleted;

    return {
      ...item,
      is_locked: isLocked,
    };
  });

  return successResponse(200, 'SUCCESS', lessons, origin);
}

export async function handleGetLesson(
  request: Request,
  env: Env,
  origin: string,
  lessonId: string,
  userId?: number,
  profileIdHeader?: string | null
): Promise<Response> {
  const url = new URL(request.url);
  const targetProfileId = userId ? await resolveProfileId(env, userId, url.searchParams.get('profile_id') || profileIdHeader) : null;
  const lessonIdNum = Number.parseInt(lessonId, 10);

  let query = 'SELECT l.*';
  if (targetProfileId) {
    query += `,
      (SELECT ll.status FROM learner_lessons ll WHERE ll.lesson_id = l.id AND ll.profile_id = ${targetProfileId}) as learner_status,
      (SELECT ll.score FROM learner_lessons ll WHERE ll.lesson_id = l.id AND ll.profile_id = ${targetProfileId}) as score,
      (SELECT ll.meta FROM learner_lessons ll WHERE ll.lesson_id = l.id AND ll.profile_id = ${targetProfileId}) as learner_meta
    `;
  }
  query += ' FROM lessons l WHERE l.id = ? LIMIT 1';

  const lesson = await env.DB.prepare(query).bind(!Number.isNaN(lessonIdNum) ? lessonIdNum : lessonId).first<Record<string, unknown>>();
  if (!lesson) return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy bài học', origin);

  // Kiểm tra bài học liền kề trước đó xem có bị lock không
  let isLocked = false;
  const courseId = lesson.course_id as number;
  const sortOrder = Number(lesson.sort_order);
  const createdAt = Number(lesson.created_at);

  const prevLesson = await env.DB.prepare(`
    SELECT id FROM lessons 
    WHERE course_id = ? AND status = 'published'
      AND (sort_order < ? OR (sort_order = ? AND created_at < ?))
    ORDER BY sort_order DESC, created_at DESC 
    LIMIT 1
  `).bind(courseId, sortOrder, sortOrder, createdAt).first<{ id: number }>();

  if (prevLesson && targetProfileId) {
    const prevProgress = await env.DB.prepare(`
      SELECT status FROM learner_lessons 
      WHERE profile_id = ? AND lesson_id = ?
    `).bind(targetProfileId, prevLesson.id).first<{ status: string }>();

    if (!prevProgress || prevProgress.status !== 'completed') {
      isLocked = true;
    }
  }

  const result = {
    ...lesson,
    is_locked: isLocked,
  };

  return successResponse(200, 'SUCCESS', result, origin);
}

export async function handleCreateLesson(request: Request, env: Env, origin: string, courseId: string): Promise<Response> {
  const courseIdNum = Number.parseInt(courseId, 10);
  if (Number.isNaN(courseIdNum)) {
    return errorResponse(400, 'VALIDATION_ERROR', 'courseId không hợp lệ', origin);
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || !body.title) {
    return errorResponse(400, 'VALIDATION_ERROR', 'title là bắt buộc', origin);
  }

  const now = Date.now();

  try {
    const res = await env.DB.prepare(`
      INSERT INTO lessons (course_id, title, sort_order, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      courseIdNum,
      String(body.title).trim(),
      typeof body.sort_order === 'number' ? body.sort_order : 0,
      body.status ? String(body.status).trim() : 'published',
      now,
      now
    ).run();

    const id = res.meta?.last_row_id;
    const created = await env.DB.prepare('SELECT * FROM lessons WHERE id = ?').bind(id).first();
    return successResponse(201, 'CREATED', created, origin);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(500, 'INTERNAL_ERROR', message, origin);
  }
}
