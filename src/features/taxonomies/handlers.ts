import { errorResponse, successResponse } from '../../utils/response.ts';

// 1. Taxonomies Handlers
export async function handleListTaxonomies(env: Env, origin: string): Promise<Response> {
  const { results } = await env.DB.prepare(`
    SELECT t.*,
      (SELECT COUNT(*) FROM taxonomy_terms tt WHERE tt.taxonomy_id = t.id) as terms_count
    FROM taxonomies t
    ORDER BY t.sort_order ASC, t.name ASC
  `).all();

  return successResponse(200, 'SUCCESS', results ?? [], origin);
}

export async function handleGetTaxonomy(env: Env, origin: string, idOrCode: string): Promise<Response> {
  const idNum = Number.parseInt(idOrCode, 10);
  const taxonomy = await env.DB.prepare(
    !Number.isNaN(idNum) ? 'SELECT * FROM taxonomies WHERE id = ? OR code = ? LIMIT 1' : 'SELECT * FROM taxonomies WHERE code = ? LIMIT 1'
  ).bind(!Number.isNaN(idNum) ? idNum : idOrCode, idOrCode).first<Record<string, unknown>>();

  if (!taxonomy) return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy taxonomy', origin);

  const { results: terms } = await env.DB.prepare(`
    SELECT * FROM taxonomy_terms WHERE taxonomy_id = ? ORDER BY sort_order ASC, name ASC
  `).bind(taxonomy.id).all();

  return successResponse(200, 'SUCCESS', { ...taxonomy, terms: terms ?? [] }, origin);
}

export async function handleCreateTaxonomy(request: Request, env: Env, origin: string): Promise<Response> {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || !body.code || !body.name) {
    return errorResponse(400, 'VALIDATION_ERROR', 'code và name là bắt buộc', origin);
  }

  const now = Date.now();

  try {
    const res = await env.DB.prepare(`
      INSERT INTO taxonomies (code, name, description, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      String(body.code).trim().toLowerCase(),
      String(body.name).trim(),
      body.description ? String(body.description).trim() : null,
      typeof body.sort_order === 'number' ? body.sort_order : 0,
      now,
      now
    ).run();

    const newId = res.meta?.last_row_id;
    const created = await env.DB.prepare('SELECT * FROM taxonomies WHERE id = ?').bind(newId).first();
    return successResponse(201, 'CREATED', created, origin);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('UNIQUE constraint failed')) {
      return errorResponse(409, 'CONFLICT', 'Mã taxonomy (code) đã tồn tại', origin);
    }
    return errorResponse(500, 'INTERNAL_ERROR', message, origin);
  }
}

// 2. Taxonomy Terms Handlers
export async function handleListTaxonomyTerms(request: Request, env: Env, origin: string, taxonomyIdOrCode?: string): Promise<Response> {
  const url = new URL(request.url);
  const tax = taxonomyIdOrCode || url.searchParams.get('taxonomy');

  let query = 'SELECT tt.*, t.code as taxonomy_code, t.name as taxonomy_name FROM taxonomy_terms tt JOIN taxonomies t ON t.id = tt.taxonomy_id';
  const params: unknown[] = [];

  if (tax) {
    const taxNum = Number.parseInt(tax, 10);
    if (!Number.isNaN(taxNum)) {
      query += ' WHERE t.id = ? OR t.code = ?';
      params.push(taxNum, tax);
    } else {
      query += ' WHERE t.code = ?';
      params.push(tax);
    }
  }

  query += ' ORDER BY tt.sort_order ASC, tt.name ASC';

  const { results } = await env.DB.prepare(query).bind(...params).all();
  return successResponse(200, 'SUCCESS', results ?? [], origin);
}

export async function handleCreateTaxonomyTerm(request: Request, env: Env, origin: string, taxonomyId: string): Promise<Response> {
  const taxNum = Number.parseInt(taxonomyId, 10);
  const taxonomy = await env.DB.prepare(
    !Number.isNaN(taxNum) ? 'SELECT id FROM taxonomies WHERE id = ? OR code = ?' : 'SELECT id FROM taxonomies WHERE code = ?'
  ).bind(!Number.isNaN(taxNum) ? taxNum : taxonomyId, taxonomyId).first<{ id: number }>();

  if (!taxonomy) return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy nhóm taxonomy', origin);

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || !body.code || !body.name) {
    return errorResponse(400, 'VALIDATION_ERROR', 'code và name là bắt buộc', origin);
  }

  const now = Date.now();
  const parentIdNum = body.parent_id ? Number.parseInt(String(body.parent_id), 10) : null;

  try {
    const res = await env.DB.prepare(`
      INSERT INTO taxonomy_terms (taxonomy_id, parent_id, code, name, description, icon, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      taxonomy.id,
      parentIdNum && !Number.isNaN(parentIdNum) ? parentIdNum : null,
      String(body.code).trim().toLowerCase(),
      String(body.name).trim(),
      body.description ? String(body.description).trim() : null,
      body.icon ? String(body.icon).trim() : null,
      typeof body.sort_order === 'number' ? body.sort_order : 0,
      now,
      now
    ).run();

    const newId = res.meta?.last_row_id;
    const created = await env.DB.prepare('SELECT * FROM taxonomy_terms WHERE id = ?').bind(newId).first();
    return successResponse(201, 'CREATED', created, origin);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('UNIQUE constraint failed')) {
      return errorResponse(409, 'CONFLICT', 'Mã term (code) đã tồn tại trong nhóm này', origin);
    }
    return errorResponse(500, 'INTERNAL_ERROR', message, origin);
  }
}

export async function handleUpdateTaxonomy(request: Request, env: Env, origin: string, idOrCode: string): Promise<Response> {
  const idNum = Number.parseInt(idOrCode, 10);
  const taxonomy = await env.DB.prepare(
    !Number.isNaN(idNum) ? 'SELECT * FROM taxonomies WHERE id = ? OR code = ? LIMIT 1' : 'SELECT * FROM taxonomies WHERE code = ? LIMIT 1'
  ).bind(!Number.isNaN(idNum) ? idNum : idOrCode, idOrCode).first<Record<string, unknown>>();

  if (!taxonomy) return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy taxonomy', origin);

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return errorResponse(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ', origin);

  const name = body.name !== undefined ? String(body.name).trim() : taxonomy.name;
  const description = body.description !== undefined ? (body.description ? String(body.description).trim() : null) : taxonomy.description;
  const sortOrder = typeof body.sort_order === 'number' ? body.sort_order : taxonomy.sort_order;
  const now = Date.now();

  try {
    await env.DB.prepare(`
      UPDATE taxonomies SET name = ?, description = ?, sort_order = ?, updated_at = ?
      WHERE id = ?
    `).bind(name, description, sortOrder, now, taxonomy.id).run();

    const updated = await env.DB.prepare('SELECT * FROM taxonomies WHERE id = ?').bind(taxonomy.id).first();
    return successResponse(200, 'UPDATED', updated, origin);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(500, 'INTERNAL_ERROR', message, origin);
  }
}

export async function handleDeleteTaxonomy(env: Env, origin: string, idOrCode: string): Promise<Response> {
  const idNum = Number.parseInt(idOrCode, 10);
  const taxonomy = await env.DB.prepare(
    !Number.isNaN(idNum) ? 'SELECT id FROM taxonomies WHERE id = ? OR code = ? LIMIT 1' : 'SELECT id FROM taxonomies WHERE code = ? LIMIT 1'
  ).bind(!Number.isNaN(idNum) ? idNum : idOrCode, idOrCode).first<{ id: number }>();

  if (!taxonomy) return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy taxonomy', origin);

  await env.DB.prepare('DELETE FROM taxonomies WHERE id = ?').bind(taxonomy.id).run();
  return successResponse(200, 'DELETED', { id: taxonomy.id }, origin);
}

export async function handleUpdateTaxonomyTerm(request: Request, env: Env, origin: string, termId: string): Promise<Response> {
  const termIdNum = Number.parseInt(termId, 10);
  if (Number.isNaN(termIdNum)) return errorResponse(400, 'VALIDATION_ERROR', 'ID term không hợp lệ', origin);

  const current = await env.DB.prepare('SELECT * FROM taxonomy_terms WHERE id = ? LIMIT 1')
    .bind(termIdNum).first<Record<string, unknown>>();
  if (!current) return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy term', origin);

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return errorResponse(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ', origin);

  const name = body.name !== undefined ? String(body.name).trim() : current.name;
  const description = body.description !== undefined ? (body.description ? String(body.description).trim() : null) : current.description;
  const icon = body.icon !== undefined ? (body.icon ? String(body.icon).trim() : null) : current.icon;
  const sortOrder = typeof body.sort_order === 'number' ? body.sort_order : current.sort_order;
  const parentId = body.parent_id !== undefined
    ? (body.parent_id ? Number.parseInt(String(body.parent_id), 10) : null)
    : current.parent_id;
  const now = Date.now();

  try {
    await env.DB.prepare(`
      UPDATE taxonomy_terms 
      SET name = ?, description = ?, icon = ?, sort_order = ?, parent_id = ?, updated_at = ?
      WHERE id = ?
    `).bind(name, description, icon, sortOrder, parentId, now, termIdNum).run();

    const updated = await env.DB.prepare('SELECT * FROM taxonomy_terms WHERE id = ?').bind(termIdNum).first();
    return successResponse(200, 'UPDATED', updated, origin);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(500, 'INTERNAL_ERROR', message, origin);
  }
}

export async function handleDeleteTaxonomyTerm(env: Env, origin: string, termId: string): Promise<Response> {
  const termIdNum = Number.parseInt(termId, 10);
  if (Number.isNaN(termIdNum)) return errorResponse(400, 'VALIDATION_ERROR', 'ID term không hợp lệ', origin);

  const current = await env.DB.prepare('SELECT id FROM taxonomy_terms WHERE id = ? LIMIT 1')
    .bind(termIdNum).first<{ id: number }>();
  if (!current) return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy term', origin);

  await env.DB.prepare('DELETE FROM taxonomy_terms WHERE id = ?').bind(termIdNum).run();
  return successResponse(200, 'DELETED', { id: termIdNum }, origin);
}

