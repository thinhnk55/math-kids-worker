import { parsePagination } from '../../utils/pagination.ts';
import { errorResponse, successResponse } from '../../utils/response.ts';
import { generateUUIDv7 } from '../../utils/uuid.ts';

export async function handleListCourses(
  request: Request,
  env: Env,
  origin: string,
  userId?: number,
  profileId?: string
): Promise<Response> {
  const url = new URL(request.url);
  const { page, size, offset } = parsePagination(url);
  const q = url.searchParams.get('q')?.trim();
  const taxonomyTermId = url.searchParams.get('term_id') || url.searchParams.get('taxonomy_term_id');
  const taxonomyCode = url.searchParams.get('taxonomy')?.trim();

  const whereConditions: string[] = ["c.status = 'published'"];
  const params: unknown[] = [];

  if (q) {
    whereConditions.push('(c.title LIKE ? OR c.description LIKE ?)');
    const searchTerm = `%${q}%`;
    params.push(searchTerm, searchTerm);
  }

  if (taxonomyTermId) {
    whereConditions.push('EXISTS (SELECT 1 FROM course_taxonomy_terms ctt WHERE ctt.course_id = c.id AND ctt.taxonomy_term_id = ?)');
    params.push(taxonomyTermId);
  }

  if (taxonomyCode) {
    whereConditions.push(`EXISTS (
      SELECT 1 FROM course_taxonomy_terms ctt 
      JOIN taxonomy_terms tt ON tt.id = ctt.taxonomy_term_id
      JOIN taxonomies t ON t.id = tt.taxonomy_id
      WHERE ctt.course_id = c.id AND (t.code = ? OR t.id = ?)
    )`);
    params.push(taxonomyCode, taxonomyCode);
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  // Count total
  const countQuery = `SELECT COUNT(*) as total FROM courses c ${whereClause}`;
  const totalRes = await env.DB.prepare(countQuery).bind(...params).first<{ total: number }>();
  const total = totalRes?.total ?? 0;

  // List courses
  let listQuery = `
    SELECT 
      c.*,
      (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id AND l.status = 'published') as total_lessons
  `;

  if (profileId) {
    const numProfileId = Number.parseInt(profileId, 10);
    listQuery += `,
      (SELECT lc.status FROM learner_courses lc WHERE lc.course_id = c.id AND lc.profile_id = ${numProfileId}) as enrolled_status,
      (SELECT COUNT(*) FROM learner_lessons ll WHERE ll.course_id = c.id AND ll.profile_id = ${numProfileId} AND ll.status = 'completed') as completed_lessons
    `;
  } else if (userId) {
    listQuery += `,
      (SELECT lc.status FROM learner_courses lc WHERE lc.course_id = c.id AND lc.user_id = ${userId}) as enrolled_status,
      (SELECT COUNT(*) FROM learner_lessons ll WHERE ll.course_id = c.id AND ll.user_id = ${userId} AND ll.status = 'completed') as completed_lessons
    `;
  }

  listQuery += `
    FROM courses c
    ${whereClause}
    ORDER BY c.sort_order ASC, c.created_at DESC
    LIMIT ? OFFSET ?
  `;

  const { results } = await env.DB.prepare(listQuery).bind(...params, size, offset).all();

  return successResponse(200, 'SUCCESS', results ?? [], origin, { page, size, total });
}

export async function handleGetCourse(
  env: Env,
  origin: string,
  courseIdOrSlug: string,
  userId?: number,
  profileId?: string
): Promise<Response> {
  let query = `
    SELECT 
      c.*,
      (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id AND l.status = 'published') as total_lessons
  `;

  if (profileId) {
    const numProfileId = Number.parseInt(profileId, 10);
    query += `,
      (SELECT lc.status FROM learner_courses lc WHERE lc.course_id = c.id AND lc.profile_id = ${numProfileId}) as enrolled_status,
      (SELECT lc.last_lesson_id FROM learner_courses lc WHERE lc.course_id = c.id AND lc.profile_id = ${numProfileId}) as last_lesson_id,
      (SELECT COUNT(*) FROM learner_lessons ll WHERE ll.course_id = c.id AND ll.profile_id = ${numProfileId} AND ll.status = 'completed') as completed_lessons
    `;
  } else if (userId) {
    query += `,
      (SELECT lc.status FROM learner_courses lc WHERE lc.course_id = c.id AND lc.user_id = ${userId}) as enrolled_status,
      (SELECT lc.last_lesson_id FROM learner_courses lc WHERE lc.course_id = c.id AND lc.user_id = ${userId}) as last_lesson_id,
      (SELECT COUNT(*) FROM learner_lessons ll WHERE ll.course_id = c.id AND ll.user_id = ${userId} AND ll.status = 'completed') as completed_lessons
    `;
  }

  query += `
    FROM courses c
    WHERE c.id = ? OR c.slug = ?
    LIMIT 1
  `;

  const course = await env.DB.prepare(query).bind(courseIdOrSlug, courseIdOrSlug).first<Record<string, unknown>>();
  if (!course) return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy khoá học', origin);

  // Fetch Lessons and calculate sequential access
  const condition = profileId ? `ll.profile_id = ${Number.parseInt(profileId, 10)}` : userId ? `ll.user_id = ${userId}` : null;
  const lessonsRes = await env.DB.prepare(`
    SELECT l.* ${condition ? `, (SELECT ll.status FROM learner_lessons ll WHERE ll.lesson_id = l.id AND ${condition}) as learner_status,
      (SELECT ll.stars FROM learner_lessons ll WHERE ll.lesson_id = l.id AND ${condition}) as stars,
      (SELECT ll.score FROM learner_lessons ll WHERE ll.lesson_id = l.id AND ${condition}) as score` : ''}
    FROM lessons l
    WHERE l.course_id = ? AND l.status = 'published'
    ORDER BY l.sort_order ASC, l.created_at ASC
  `).bind(course.id).all();

  // Fetch Taxonomy Terms of this course
  const termsRes = await env.DB.prepare(`
    SELECT tt.id, tt.code, tt.name, tt.icon, t.code as taxonomy_code, t.name as taxonomy_name
    FROM taxonomy_terms tt
    JOIN taxonomies t ON t.id = tt.taxonomy_id
    JOIN course_taxonomy_terms ctt ON ctt.taxonomy_term_id = tt.id
    WHERE ctt.course_id = ?
    ORDER BY tt.sort_order ASC
  `).bind(course.id).all();

  const rawLessons = (lessonsRes.results ?? []) as Array<Record<string, unknown>>;
  let previousLessonCompleted = true; // Bài đầu tiên luôn được mở

  const lessons = rawLessons.map((item, index) => {
    const isCompleted = item.learner_status === 'completed';
    // Bài đầu tiên (index === 0) luôn mở (is_locked = false)
    // Các bài tiếp theo chỉ mở nếu bài liền trước đã completed
    const isLocked = index === 0 ? false : !previousLessonCompleted;
    previousLessonCompleted = isCompleted;

    return {
      ...item,
      is_locked: isLocked,
    };
  });

  const fullData = {
    ...course,
    taxonomy_terms: termsRes.results ?? [],
    lessons,
  };

  return successResponse(200, 'SUCCESS', fullData, origin);
}

export async function handleCreateCourse(request: Request, env: Env, origin: string): Promise<Response> {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || !body.title || !body.slug) {
    return errorResponse(400, 'VALIDATION_ERROR', 'title và slug là bắt buộc', origin);
  }

  const id = generateUUIDv7();
  const now = Date.now();

  try {
    await env.DB.prepare(`
      INSERT INTO courses (id, slug, title, description, cover_url, status, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      String(body.slug).trim().toLowerCase(),
      String(body.title).trim(),
      body.description ? String(body.description).trim() : null,
      body.cover_url ? String(body.cover_url).trim() : null,
      body.status ? String(body.status).trim() : 'published',
      typeof body.sort_order === 'number' ? body.sort_order : 0,
      now,
      now
    ).run();

    // Link Taxonomy Terms if provided
    const termIds = body.taxonomy_term_ids || body.term_ids;
    if (Array.isArray(termIds) && termIds.length > 0) {
      for (const termId of termIds) {
        await env.DB.prepare('INSERT OR IGNORE INTO course_taxonomy_terms (course_id, taxonomy_term_id) VALUES (?, ?)').bind(id, termId).run();
      }
    }

    const created = await env.DB.prepare('SELECT * FROM courses WHERE id = ?').bind(id).first();
    return successResponse(201, 'CREATED', created, origin);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('UNIQUE constraint failed')) {
      return errorResponse(409, 'CONFLICT', 'Slug khoá học đã tồn tại', origin);
    }
    return errorResponse(500, 'INTERNAL_ERROR', message, origin);
  }
}
