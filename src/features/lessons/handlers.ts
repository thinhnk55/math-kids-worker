import { errorResponse, successResponse } from '../../utils/response.ts';
import { slugify } from '../../utils/slug.ts';

export async function handleListLessons(
  request: Request,
  env: Env,
  origin: string,
  courseId: string,
  userId?: number,
  profileId?: number | null
): Promise<Response> {
  const url = new URL(request.url);
  const targetProfileId = profileId ?? null;
  const courseIdNum = Number.parseInt(courseId, 10);

  const statusParam = url.searchParams.get('status')?.trim();

  let query = 'SELECT l.*';
  if (targetProfileId) {
    query += `,
      (SELECT ll.status FROM learner_lessons ll WHERE ll.lesson_id = l.id AND ll.profile_id = ${targetProfileId}) as learner_status,
      (SELECT ll.score FROM learner_lessons ll WHERE ll.lesson_id = l.id AND ll.profile_id = ${targetProfileId}) as score,
      (SELECT ll.meta FROM learner_lessons ll WHERE ll.lesson_id = l.id AND ll.profile_id = ${targetProfileId}) as learner_meta
    `;
  }

  const whereConditions = ['l.course_id = ?'];
  const queryBindings: unknown[] = [!Number.isNaN(courseIdNum) ? courseIdNum : courseId];

  if (statusParam) {
    whereConditions.push('l.status = ?');
    queryBindings.push(statusParam);
  } else if (userId || targetProfileId) {
    whereConditions.push("l.status = 'published'");
  }

  query += ` FROM lessons l WHERE ${whereConditions.join(' AND ')} ORDER BY l.sort_order ASC, l.created_at ASC`;

  const { results } = await env.DB.prepare(query).bind(...queryBindings).all();
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
  profileId?: number | null
): Promise<Response> {
  const targetProfileId = profileId ?? null;
  const lessonIdNum = Number.parseInt(lessonId, 10);

  let query = 'SELECT l.*';
  if (targetProfileId) {
    query += `,
      (SELECT ll.status FROM learner_lessons ll WHERE ll.lesson_id = l.id AND ll.profile_id = ${targetProfileId}) as learner_status,
      (SELECT ll.score FROM learner_lessons ll WHERE ll.lesson_id = l.id AND ll.profile_id = ${targetProfileId}) as score,
      (SELECT ll.meta FROM learner_lessons ll WHERE ll.lesson_id = l.id AND ll.profile_id = ${targetProfileId}) as learner_meta
    `;
  }
  query += ` FROM lessons l WHERE ${!Number.isNaN(lessonIdNum) ? 'l.id = ? OR l.slug = ?' : 'l.slug = ?'} LIMIT 1`;

  const queryParams = !Number.isNaN(lessonIdNum) ? [lessonIdNum, lessonId] : [lessonId];
  const lesson = await env.DB.prepare(query).bind(...queryParams).first<Record<string, unknown>>();
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

  const title = String(body.title).trim();
  const rawSlug = body.slug ? String(body.slug).trim().toLowerCase() : slugify(title);
  const slug = rawSlug || `bai-${Date.now()}`;
  const now = Date.now();

  try {
    const res = await env.DB.prepare(`
      INSERT INTO lessons (course_id, slug, title, cover_url, sort_order, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      courseIdNum,
      slug,
      title,
      body.cover_url ? String(body.cover_url).trim() : null,
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
    if (message.includes('UNIQUE constraint failed')) {
      return errorResponse(409, 'CONFLICT', 'Đường dẫn bài học đã tồn tại trong khóa học này', origin);
    }
    return errorResponse(500, 'INTERNAL_ERROR', message, origin);
  }
}

export async function handleUpdateLesson(request: Request, env: Env, origin: string, lessonId: string): Promise<Response> {
  const lessonIdNum = Number.parseInt(lessonId, 10);
  if (Number.isNaN(lessonIdNum)) return errorResponse(400, 'VALIDATION_ERROR', 'lessonId không hợp lệ', origin);

  const current = await env.DB.prepare('SELECT * FROM lessons WHERE id = ? LIMIT 1').bind(lessonIdNum).first<Record<string, unknown>>();
  if (!current) return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy bài học', origin);

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return errorResponse(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ', origin);

  const title = body.title !== undefined ? String(body.title).trim() : current.title;
  const slug = body.slug !== undefined
    ? String(body.slug).trim().toLowerCase()
    : (body.title !== undefined ? slugify(String(body.title).trim()) : current.slug);
  const coverUrl = body.cover_url !== undefined ? (body.cover_url ? String(body.cover_url).trim() : null) : current.cover_url;
  const sortOrder = typeof body.sort_order === 'number' ? body.sort_order : current.sort_order;
  const status = body.status !== undefined ? String(body.status).trim() : current.status;
  const now = Date.now();

  try {
    await env.DB.prepare(`
      UPDATE lessons 
      SET title = ?, slug = ?, cover_url = ?, sort_order = ?, status = ?, updated_at = ?
      WHERE id = ?
    `).bind(title, slug, coverUrl, sortOrder, status, now, lessonIdNum).run();

    const updated = await env.DB.prepare('SELECT * FROM lessons WHERE id = ?').bind(lessonIdNum).first();
    return successResponse(200, 'UPDATED', updated, origin);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('UNIQUE constraint failed')) {
      return errorResponse(409, 'CONFLICT', 'Đường dẫn bài học đã tồn tại trong khóa học này', origin);
    }
    return errorResponse(500, 'INTERNAL_ERROR', message, origin);
  }
}

export async function handleDeleteLesson(env: Env, origin: string, lessonId: string): Promise<Response> {
  const lessonIdNum = Number.parseInt(lessonId, 10);
  if (Number.isNaN(lessonIdNum)) return errorResponse(400, 'VALIDATION_ERROR', 'lessonId không hợp lệ', origin);

  const current = await env.DB.prepare('SELECT id FROM lessons WHERE id = ? LIMIT 1').bind(lessonIdNum).first<{ id: number }>();
  if (!current) return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy bài học', origin);

  await env.DB.prepare('DELETE FROM lessons WHERE id = ?').bind(lessonIdNum).run();
  return successResponse(200, 'DELETED', { id: lessonIdNum }, origin);
}

