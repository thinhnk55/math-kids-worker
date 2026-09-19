import { errorResponse, successResponse } from '../../utils/response.ts';

export async function handleListRoadmaps(env: Env, origin: string): Promise<Response> {
  const { results } = await env.DB.prepare(`
    SELECT * FROM roadmaps WHERE status = 'published' ORDER BY sort_order ASC, created_at DESC
  `).all();

  return successResponse(200, 'SUCCESS', results ?? [], origin);
}

export async function handleGetRoadmap(
  env: Env,
  origin: string,
  roadmapIdOrCode: string,
  userId?: number,
  profileId?: string
): Promise<Response> {
  const roadmapIdNum = Number.parseInt(roadmapIdOrCode, 10);
  const roadmap = await env.DB.prepare(
    !Number.isNaN(roadmapIdNum) ? 'SELECT * FROM roadmaps WHERE (id = ? OR code = ?) AND status = \'published\' LIMIT 1' : 'SELECT * FROM roadmaps WHERE code = ? AND status = \'published\' LIMIT 1'
  ).bind(!Number.isNaN(roadmapIdNum) ? roadmapIdNum : roadmapIdOrCode, roadmapIdOrCode).first<Record<string, unknown>>();

  if (!roadmap) return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy lộ trình học', origin);

  // Fetch courses in roadmap
  let query = `
    SELECT 
      c.*,
      rc.step_order,
      (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id AND l.status = 'published') as total_lessons
  `;

  if (profileId) {
    const numProfileId = Number.parseInt(profileId, 10);
    query += `,
      (SELECT lc.status FROM learner_courses lc WHERE lc.course_id = c.id AND lc.profile_id = ${numProfileId}) as enrolled_status,
      (SELECT COUNT(*) FROM learner_lessons ll WHERE ll.course_id = c.id AND ll.profile_id = ${numProfileId} AND ll.status = 'completed') as completed_lessons
    `;
  } else if (userId) {
    query += `,
      (SELECT lc.status FROM learner_courses lc WHERE lc.course_id = c.id AND lc.user_id = ${userId}) as enrolled_status,
      (SELECT COUNT(*) FROM learner_lessons ll WHERE ll.course_id = c.id AND ll.user_id = ${userId} AND ll.status = 'completed') as completed_lessons
    `;
  }

  query += `
    FROM roadmap_courses rc
    JOIN courses c ON c.id = rc.course_id
    WHERE rc.roadmap_id = ? AND c.status = 'published'
    ORDER BY rc.step_order ASC
  `;

  const { results } = await env.DB.prepare(query).bind(roadmap.id).all();

  return successResponse(200, 'SUCCESS', {
    ...roadmap,
    courses: results ?? [],
  }, origin);
}

export async function handleCreateRoadmap(request: Request, env: Env, origin: string): Promise<Response> {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || !body.name || !body.code) {
    return errorResponse(400, 'VALIDATION_ERROR', 'name và code là bắt buộc', origin);
  }

  const now = Date.now();

  try {
    const res = await env.DB.prepare(`
      INSERT INTO roadmaps (code, name, description, age_range, status, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      String(body.code).trim().toLowerCase(),
      String(body.name).trim(),
      body.description ? String(body.description).trim() : null,
      body.age_range ? String(body.age_range).trim() : null,
      body.status ? String(body.status).trim() : 'published',
      typeof body.sort_order === 'number' ? body.sort_order : 0,
      now,
      now
    ).run();

    const id = res.meta?.last_row_id;

    if (Array.isArray(body.course_ids) && body.course_ids.length > 0 && id) {
      for (let i = 0; i < body.course_ids.length; i++) {
        const cId = typeof body.course_ids[i] === 'number' ? body.course_ids[i] : Number.parseInt(String(body.course_ids[i]), 10);
        if (!Number.isNaN(cId)) {
          await env.DB.prepare('INSERT OR IGNORE INTO roadmap_courses (roadmap_id, course_id, step_order) VALUES (?, ?, ?)')
            .bind(id, cId, i + 1)
            .run();
        }
      }
    }

    const created = await env.DB.prepare('SELECT * FROM roadmaps WHERE id = ?').bind(id).first();
    return successResponse(201, 'CREATED', created, origin);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('UNIQUE constraint failed')) {
      return errorResponse(409, 'CONFLICT', 'Code lộ trình đã tồn tại', origin);
    }
    return errorResponse(500, 'INTERNAL_ERROR', message, origin);
  }
}
