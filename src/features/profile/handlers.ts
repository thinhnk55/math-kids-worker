import { errorResponse, successResponse } from '../../utils/response.ts';
import { generateUUIDv7 } from '../../utils/uuid.ts';

const MAX_PROFILES_PER_USER = 3;

export async function handleListProfiles(env: Env, origin: string, userId: string): Promise<Response> {
  const { results } = await env.DB.prepare(`
    SELECT * FROM profiles WHERE user_id = ? ORDER BY is_default DESC, created_at ASC
  `).bind(userId).all();

  return successResponse(200, 'SUCCESS', results ?? [], origin);
}

export async function handleGetProfile(env: Env, origin: string, userId: string, profileId: string): Promise<Response> {
  const profile = await env.DB.prepare(`
    SELECT * FROM profiles WHERE id = ? AND user_id = ?
  `).bind(profileId, userId).first();

  if (!profile) return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy hồ sơ người học', origin);
  return successResponse(200, 'SUCCESS', profile, origin);
}

export async function handleCreateProfile(request: Request, env: Env, origin: string, userId: string): Promise<Response> {
  // Check count of profiles
  const countRes = await env.DB.prepare('SELECT COUNT(*) as total FROM profiles WHERE user_id = ?')
    .bind(userId).first<{ total: number }>();
  const total = countRes?.total ?? 0;

  if (total >= MAX_PROFILES_PER_USER) {
    return errorResponse(400, 'BAD_REQUEST', `Mỗi tài khoản chỉ có thể tạo tối đa ${MAX_PROFILES_PER_USER} hồ sơ học sinh`, origin);
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || !body.name || !String(body.name).trim()) {
    return errorResponse(400, 'VALIDATION_ERROR', 'Tên người học (name) là bắt buộc', origin);
  }

  const id = generateUUIDv7();
  const name = String(body.name).trim();
  const avatar = body.avatar ? String(body.avatar).trim() : null;
  const isDefault = total === 0 ? 1 : (body.is_default ? 1 : 0);
  const now = Date.now();

  if (isDefault === 1) {
    await env.DB.prepare('UPDATE profiles SET is_default = 0 WHERE user_id = ?').bind(userId).run();
  }

  await env.DB.prepare(`
    INSERT INTO profiles (id, user_id, name, avatar, is_default, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(id, userId, name, avatar, isDefault, now, now).run();

  const profile = await env.DB.prepare('SELECT * FROM profiles WHERE id = ?').bind(id).first();
  return successResponse(201, 'CREATED', profile, origin);
}

export async function handleUpdateProfile(
  request: Request,
  env: Env,
  origin: string,
  userId: string,
  profileId: string
): Promise<Response> {
  const existing = await env.DB.prepare('SELECT id FROM profiles WHERE id = ? AND user_id = ?')
    .bind(profileId, userId).first();
  if (!existing) return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy hồ sơ người học', origin);

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return errorResponse(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ', origin);

  const now = Date.now();
  const name = body.name !== undefined ? String(body.name).trim() : null;
  const avatar = body.avatar !== undefined ? (body.avatar ? String(body.avatar).trim() : null) : undefined;
  const isDefault = body.is_default !== undefined ? (body.is_default ? 1 : 0) : undefined;

  if (isDefault === 1) {
    await env.DB.prepare('UPDATE profiles SET is_default = 0 WHERE user_id = ?').bind(userId).run();
  }

  let updateQuery = 'UPDATE profiles SET updated_at = ?';
  const params: unknown[] = [now];

  if (name !== null) {
    updateQuery += ', name = ?';
    params.push(name);
  }
  if (avatar !== undefined) {
    updateQuery += ', avatar = ?';
    params.push(avatar);
  }
  if (isDefault !== undefined) {
    updateQuery += ', is_default = ?';
    params.push(isDefault);
  }

  updateQuery += ' WHERE id = ? AND user_id = ?';
  params.push(profileId, userId);

  await env.DB.prepare(updateQuery).bind(...params).run();

  const profile = await env.DB.prepare('SELECT * FROM profiles WHERE id = ?').bind(profileId).first();
  return successResponse(200, 'UPDATED', profile, origin);
}

export async function handleDeleteProfile(env: Env, origin: string, userId: string, profileId: string): Promise<Response> {
  const existing = await env.DB.prepare('SELECT id, is_default FROM profiles WHERE id = ? AND user_id = ?')
    .bind(profileId, userId).first<{ id: string; is_default: number }>();
  if (!existing) return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy hồ sơ', origin);

  await env.DB.prepare('DELETE FROM profiles WHERE id = ? AND user_id = ?').bind(profileId, userId).run();

  // If deleted profile was default, make another one default
  if (existing.is_default === 1) {
    const nextProfile = await env.DB.prepare('SELECT id FROM profiles WHERE user_id = ? ORDER BY created_at ASC LIMIT 1')
      .bind(userId).first<{ id: string }>();
    if (nextProfile) {
      await env.DB.prepare('UPDATE profiles SET is_default = 1 WHERE id = ?').bind(nextProfile.id).run();
    }
  }

  return successResponse(200, 'DELETED', { id: profileId }, origin);
}
