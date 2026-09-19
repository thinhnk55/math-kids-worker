import { errorResponse, successResponse } from '../../utils/response.ts';
import { generateUUIDv7 } from '../../utils/uuid.ts';

export async function handleListTaxonomies(request: Request, env: Env, origin: string): Promise<Response> {
  const url = new URL(request.url);
  const type = url.searchParams.get('type');

  let query = 'SELECT * FROM taxonomies';
  const params: unknown[] = [];

  if (type) {
    query += ' WHERE type = ?';
    params.push(type);
  }
  query += ' ORDER BY sort_order ASC, name ASC';

  const stmt = params.length > 0 ? env.DB.prepare(query).bind(...params) : env.DB.prepare(query);
  const { results } = await stmt.all();

  return successResponse(200, 'SUCCESS', results ?? [], origin);
}

export async function handleCreateTaxonomy(request: Request, env: Env, origin: string): Promise<Response> {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || !body.code || !body.name || !body.type) {
    return errorResponse(400, 'VALIDATION_ERROR', 'code, name và type là bắt buộc', origin);
  }

  const id = generateUUIDv7();
  const now = Date.now();

  try {
    await env.DB.prepare(`
      INSERT INTO taxonomies (id, code, name, type, description, icon, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      String(body.code).trim().toLowerCase(),
      String(body.name).trim(),
      String(body.type).trim(),
      body.description ? String(body.description).trim() : null,
      body.icon ? String(body.icon).trim() : null,
      typeof body.sort_order === 'number' ? body.sort_order : 0,
      now,
      now
    ).run();

    const created = await env.DB.prepare('SELECT * FROM taxonomies WHERE id = ?').bind(id).first();
    return successResponse(201, 'CREATED', created, origin);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('UNIQUE constraint failed')) {
      return errorResponse(409, 'CONFLICT', 'Mã taxonomy (code) đã tồn tại', origin);
    }
    return errorResponse(500, 'INTERNAL_ERROR', message, origin);
  }
}
