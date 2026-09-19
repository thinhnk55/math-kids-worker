import { parsePagination } from '../../utils/pagination.ts';
import { errorResponse, successResponse } from '../../utils/response.ts';
import { generateUUIDv7 } from '../../utils/uuid.ts';

export async function handleListCourses(
  request: Request,
  env: Env,
  origin: string,
  userId?: string,
  profileId?: string
): Promise<Response> {
  const url = new URL(request.url);
  const { page, size, offset } = parsePagination(url);
  const q = url.searchParams.get('q')?.trim();
  const ageGroup = url.searchParams.get('age_group')?.trim();
  const level = url.searchParams.get('level')?.trim();
  const taxonomyId = url.searchParams.get('taxonomy_id')?.trim();

  const whereConditions: string[] = ["c.status = 'published'"];
  const params: unknown[] = [];

  if (q) {
    whereConditions.push('(c.title LIKE ? OR c.subtitle LIKE ? OR c.description LIKE ?)');
    const searchTerm = `%${q}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  if (ageGroup) {
    whereConditions.push('c.age_group LIKE ?');
    params.push(`%${ageGroup}%`);
  }

  if (level) {
    whereConditions.push('c.level = ?');
    params.push(level);
  }

  if (taxonomyId) {
    whereConditions.push('EXISTS (SELECT 1 FROM course_taxonomies ct WHERE ct.course_id = c.id AND ct.taxonomy_id = ?)');
    params.push(taxonomyId);
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
    listQuery += `,
      (SELECT lc.status FROM learner_courses lc WHERE lc.course_id = c.id AND lc.profile_id = '${profileId}') as enrolled_status,
      (SELECT COUNT(*) FROM learner_lessons ll WHERE ll.course_id = c.id AND ll.profile_id = '${profileId}' AND ll.status = 'completed') as completed_lessons
    `;
  } else if (userId) {
    listQuery += `,
      (SELECT lc.status FROM learner_courses lc WHERE lc.course_id = c.id AND lc.user_id = '${userId}') as enrolled_status,
      (SELECT COUNT(*) FROM learner_lessons ll WHERE ll.course_id = c.id AND ll.user_id = '${userId}' AND ll.status = 'completed') as completed_lessons
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
  userId?: string,
  profileId?: string
): Promise<Response> {
  let query = `
    SELECT 
      c.*,
      (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id AND l.status = 'published') as total_lessons
  `;

  if (profileId) {
    query += `,
      (SELECT lc.status FROM learner_courses lc WHERE lc.course_id = c.id AND lc.profile_id = '${profileId}') as enrolled_status,
      (SELECT lc.last_lesson_id FROM learner_courses lc WHERE lc.course_id = c.id AND lc.profile_id = '${profileId}') as last_lesson_id,
      (SELECT COUNT(*) FROM learner_lessons ll WHERE ll.course_id = c.id AND ll.profile_id = '${profileId}' AND ll.status = 'completed') as completed_lessons
    `;
  } else if (userId) {
    query += `,
      (SELECT lc.status FROM learner_courses lc WHERE lc.course_id = c.id AND lc.user_id = '${userId}') as enrolled_status,
      (SELECT lc.last_lesson_id FROM learner_courses lc WHERE lc.course_id = c.id AND lc.user_id = '${userId}') as last_lesson_id,
      (SELECT COUNT(*) FROM learner_lessons ll WHERE ll.course_id = c.id AND ll.user_id = '${userId}' AND ll.status = 'completed') as completed_lessons
    `;
  }

  query += `
    FROM courses c
    WHERE c.id = ? OR c.slug = ?
    LIMIT 1
  `;

  const course = await env.DB.prepare(query).bind(courseIdOrSlug, courseIdOrSlug).first<Record<string, unknown>>();
  if (!course) return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy khoá học', origin);

  // Fetch Lessons grouped by chapter
  const condition = profileId ? `ll.profile_id = '${profileId}'` : userId ? `ll.user_id = '${userId}'` : null;
  const lessonsRes = await env.DB.prepare(`
    SELECT l.* ${condition ? `, (SELECT ll.status FROM learner_lessons ll WHERE ll.lesson_id = l.id AND ${condition}) as learner_status,
      (SELECT ll.stars FROM learner_lessons ll WHERE ll.lesson_id = l.id AND ${condition}) as stars` : ''}
    FROM lessons l
    WHERE l.course_id = ? AND l.status = 'published'
    ORDER BY l.sort_order ASC, l.created_at ASC
  `).bind(course.id).all();

  const lessons = lessonsRes.results ?? [];

  // Group lessons by chapter
  const chaptersMap = new Map<string, Array<unknown>>();
  for (const item of lessons) {
    const chapterTitle = String(item.chapter_title || 'Chương 1');
    if (!chaptersMap.has(chapterTitle)) chaptersMap.set(chapterTitle, []);
    chaptersMap.get(chapterTitle)!.push(item);
  }

  const chapters = Array.from(chaptersMap.entries()).map(([title, items], index) => ({
    id: `chapter-${index + 1}`,
    title,
    lessons: items,
  }));

  // Fetch Taxonomies of this course
  const taxRes = await env.DB.prepare(`
    SELECT t.id, t.code, t.name, t.type
    FROM taxonomies t
    JOIN course_taxonomies ct ON ct.taxonomy_id = t.id
    WHERE ct.course_id = ?
    ORDER BY t.sort_order ASC
  `).bind(course.id).all();

  const fullData = {
    ...course,
    taxonomies: taxRes.results ?? [],
    chapters,
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
      INSERT INTO courses (id, slug, title, subtitle, description, cover_url, age_group, level, color_tone, status, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      String(body.slug).trim().toLowerCase(),
      String(body.title).trim(),
      body.subtitle ? String(body.subtitle).trim() : null,
      body.description ? String(body.description).trim() : null,
      body.cover_url ? String(body.cover_url).trim() : null,
      body.age_group ? String(body.age_group).trim() : null,
      body.level ? String(body.level).trim() : 'Cơ bản',
      body.color_tone ? String(body.color_tone).trim() : 'orange',
      body.status ? String(body.status).trim() : 'published',
      typeof body.sort_order === 'number' ? body.sort_order : 0,
      now,
      now
    ).run();

    // Link Taxonomies if provided
    if (Array.isArray(body.taxonomy_ids) && body.taxonomy_ids.length > 0) {
      for (const taxId of body.taxonomy_ids) {
        await env.DB.prepare('INSERT OR IGNORE INTO course_taxonomies (course_id, taxonomy_id) VALUES (?, ?)').bind(id, taxId).run();
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
