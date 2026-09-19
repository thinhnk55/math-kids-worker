import { parsePagination } from '../../utils/pagination.ts';
import { errorResponse, successResponse } from '../../utils/response.ts';

export async function handleListCourses(
  request: Request,
  env: Env,
  origin: string,
  userId?: number,
  profileId?: string,
  isAdmin?: boolean
): Promise<Response> {
  const url = new URL(request.url);
  const { page, size, offset } = parsePagination(url);
  const q = url.searchParams.get('q')?.trim() || url.searchParams.get('search')?.trim();
  const rawTaxonomyTermId = url.searchParams.get('term_id') || url.searchParams.get('taxonomy_term_id');
  const taxonomyTermId = rawTaxonomyTermId ? Number.parseInt(rawTaxonomyTermId, 10) : null;
  const taxonomyCode = url.searchParams.get('taxonomy')?.trim();
  const statusParam = url.searchParams.get('status')?.trim();

  const whereConditions: string[] = [];
  const params: unknown[] = [];

  if (statusParam) {
    whereConditions.push('c.status = ?');
    params.push(statusParam);
  } else if (!isAdmin) {
    whereConditions.push("c.status = 'published'");
  }

  if (q) {
    whereConditions.push('(c.title LIKE ? OR c.description LIKE ?)');
    const searchTerm = `%${q}%`;
    params.push(searchTerm, searchTerm);
  }

  const termCode = url.searchParams.get('term')?.trim();

  if (taxonomyTermId && !Number.isNaN(taxonomyTermId)) {
    whereConditions.push('EXISTS (SELECT 1 FROM course_taxonomy_terms ctt WHERE ctt.course_id = c.id AND ctt.taxonomy_term_id = ?)');
    params.push(taxonomyTermId);
  }

  if (termCode) {
    whereConditions.push(`EXISTS (
      SELECT 1 FROM course_taxonomy_terms ctt 
      JOIN taxonomy_terms tt ON tt.id = ctt.taxonomy_term_id
      WHERE ctt.course_id = c.id AND tt.code = ?
    )`);
    params.push(termCode);
  }

  if (taxonomyCode) {
    const taxIdNum = Number.parseInt(taxonomyCode, 10);
    if (!Number.isNaN(taxIdNum)) {
      whereConditions.push(`EXISTS (
        SELECT 1 FROM course_taxonomy_terms ctt 
        JOIN taxonomy_terms tt ON tt.id = ctt.taxonomy_term_id
        JOIN taxonomies t ON t.id = tt.taxonomy_id
        WHERE ctt.course_id = c.id AND (t.code = ? OR t.id = ?)
      )`);
      params.push(taxonomyCode, taxIdNum);
    } else {
      whereConditions.push(`EXISTS (
        SELECT 1 FROM course_taxonomy_terms ctt 
        JOIN taxonomy_terms tt ON tt.id = ctt.taxonomy_term_id
        JOIN taxonomies t ON t.id = tt.taxonomy_id
        WHERE ctt.course_id = c.id AND t.code = ?
      )`);
      params.push(taxonomyCode);
    }
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
  const courseIdNum = Number.parseInt(courseIdOrSlug, 10);
  let query = `
    SELECT 
      c.*,
      (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id AND l.status = 'published') as total_lessons
  `;

  if (profileId) {
    const numProfileId = Number.parseInt(profileId, 10);
    query += `,
      (SELECT lc.status FROM learner_courses lc WHERE lc.course_id = c.id AND lc.profile_id = ${numProfileId}) as enrolled_status,
      (SELECT lc.score FROM learner_courses lc WHERE lc.course_id = c.id AND lc.profile_id = ${numProfileId}) as learner_score,
      (SELECT lc.meta FROM learner_courses lc WHERE lc.course_id = c.id AND lc.profile_id = ${numProfileId}) as learner_meta,
      (SELECT lc.last_lesson_id FROM learner_courses lc WHERE lc.course_id = c.id AND lc.profile_id = ${numProfileId}) as last_lesson_id,
      (SELECT COUNT(*) FROM learner_lessons ll WHERE ll.course_id = c.id AND ll.profile_id = ${numProfileId} AND ll.status = 'completed') as completed_lessons
    `;
  } else if (userId) {
    query += `,
      (SELECT lc.status FROM learner_courses lc WHERE lc.course_id = c.id AND lc.user_id = ${userId}) as enrolled_status,
      (SELECT lc.score FROM learner_courses lc WHERE lc.course_id = c.id AND lc.user_id = ${userId}) as learner_score,
      (SELECT lc.meta FROM learner_courses lc WHERE lc.course_id = c.id AND lc.user_id = ${userId}) as learner_meta,
      (SELECT lc.last_lesson_id FROM learner_courses lc WHERE lc.course_id = c.id AND lc.user_id = ${userId}) as last_lesson_id,
      (SELECT COUNT(*) FROM learner_lessons ll WHERE ll.course_id = c.id AND ll.user_id = ${userId} AND ll.status = 'completed') as completed_lessons
    `;
  }

  query += `
    FROM courses c
    WHERE ${!Number.isNaN(courseIdNum) ? 'c.id = ? OR c.slug = ?' : 'c.slug = ?'}
    LIMIT 1
  `;

  const queryParams = !Number.isNaN(courseIdNum) ? [courseIdNum, courseIdOrSlug] : [courseIdOrSlug];
  const course = await env.DB.prepare(query).bind(...queryParams).first<Record<string, unknown>>();
  if (!course) return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy khoá học', origin);

  // Fetch Lessons and calculate sequential access
  const condition = profileId ? `ll.profile_id = ${Number.parseInt(profileId, 10)}` : userId ? `ll.user_id = ${userId}` : null;
  const lessonsRes = await env.DB.prepare(`
    SELECT l.* ${condition ? `, (SELECT ll.status FROM learner_lessons ll WHERE ll.lesson_id = l.id AND ${condition}) as learner_status,
      (SELECT ll.score FROM learner_lessons ll WHERE ll.lesson_id = l.id AND ${condition}) as score,
      (SELECT ll.meta FROM learner_lessons ll WHERE ll.lesson_id = l.id AND ${condition}) as learner_meta` : ''}
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

  const now = Date.now();

  try {
    const res = await env.DB.prepare(`
      INSERT INTO courses (slug, title, description, cover_url, status, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      String(body.slug).trim().toLowerCase(),
      String(body.title).trim(),
      body.description ? String(body.description).trim() : null,
      body.cover_url ? String(body.cover_url).trim() : null,
      body.status ? String(body.status).trim() : 'published',
      typeof body.sort_order === 'number' ? body.sort_order : 0,
      now,
      now
    ).run();

    const id = res.meta?.last_row_id;

    // Link Taxonomy Terms if provided
    const termIds = body.taxonomy_term_ids || body.term_ids;
    if (Array.isArray(termIds) && termIds.length > 0 && id) {
      for (const rawTermId of termIds) {
        const termId = typeof rawTermId === 'number' ? rawTermId : Number.parseInt(String(rawTermId), 10);
        if (!Number.isNaN(termId)) {
          await env.DB.prepare('INSERT OR IGNORE INTO course_taxonomy_terms (course_id, taxonomy_term_id) VALUES (?, ?)').bind(id, termId).run();
        }
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

export async function handleUpdateCourse(request: Request, env: Env, origin: string, courseId: string): Promise<Response> {
  const courseIdNum = Number.parseInt(courseId, 10);
  if (Number.isNaN(courseIdNum)) return errorResponse(400, 'VALIDATION_ERROR', 'courseId không hợp lệ', origin);

  const current = await env.DB.prepare('SELECT * FROM courses WHERE id = ? LIMIT 1').bind(courseIdNum).first<Record<string, unknown>>();
  if (!current) return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy khoá học', origin);

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return errorResponse(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ', origin);

  const title = body.title !== undefined ? String(body.title).trim() : current.title;
  const slug = body.slug !== undefined ? String(body.slug).trim().toLowerCase() : current.slug;
  const description = body.description !== undefined ? (body.description ? String(body.description).trim() : null) : current.description;
  const coverUrl = body.cover_url !== undefined ? (body.cover_url ? String(body.cover_url).trim() : null) : current.cover_url;
  const status = body.status !== undefined ? String(body.status).trim() : current.status;
  const sortOrder = typeof body.sort_order === 'number' ? body.sort_order : current.sort_order;
  const now = Date.now();

  try {
    await env.DB.prepare(`
      UPDATE courses 
      SET title = ?, slug = ?, description = ?, cover_url = ?, status = ?, sort_order = ?, updated_at = ?
      WHERE id = ?
    `).bind(title, slug, description, coverUrl, status, sortOrder, now, courseIdNum).run();

    // Cập nhật terms nếu có truyền
    const termIds = body.taxonomy_term_ids || body.term_ids;
    if (Array.isArray(termIds)) {
      await env.DB.prepare('DELETE FROM course_taxonomy_terms WHERE course_id = ?').bind(courseIdNum).run();
      for (const rawTermId of termIds) {
        const termId = typeof rawTermId === 'number' ? rawTermId : Number.parseInt(String(rawTermId), 10);
        if (!Number.isNaN(termId)) {
          await env.DB.prepare('INSERT OR IGNORE INTO course_taxonomy_terms (course_id, taxonomy_term_id) VALUES (?, ?)').bind(courseIdNum, termId).run();
        }
      }
    }

    const updated = await env.DB.prepare('SELECT * FROM courses WHERE id = ?').bind(courseIdNum).first();
    return successResponse(200, 'UPDATED', updated, origin);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('UNIQUE constraint failed')) {
      return errorResponse(409, 'CONFLICT', 'Slug khoá học đã tồn tại', origin);
    }
    return errorResponse(500, 'INTERNAL_ERROR', message, origin);
  }
}

export async function handleDeleteCourse(env: Env, origin: string, courseId: string): Promise<Response> {
  const courseIdNum = Number.parseInt(courseId, 10);
  if (Number.isNaN(courseIdNum)) return errorResponse(400, 'VALIDATION_ERROR', 'courseId không hợp lệ', origin);

  const current = await env.DB.prepare('SELECT id FROM courses WHERE id = ? LIMIT 1').bind(courseIdNum).first<{ id: number }>();
  if (!current) return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy khoá học', origin);

  await env.DB.prepare('DELETE FROM courses WHERE id = ?').bind(courseIdNum).run();
  return successResponse(200, 'DELETED', { id: courseIdNum }, origin);
}

