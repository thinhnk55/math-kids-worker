import { errorResponse, successResponse } from '../../utils/response.ts';

export async function handleGetProfile(env: Env, origin: string, userId: string): Promise<Response> {
  const profile = await env.DB.prepare('SELECT * FROM profiles WHERE user_id = ?').bind(userId).first();
  if (!profile) {
    // Return empty profile placeholder if not created yet
    return successResponse(200, 'SUCCESS', {
      user_id: userId,
      display_name: '',
      avatar_url: null,
      grade_level: 'grade_1',
      birth_year: null,
    }, origin);
  }

  return successResponse(200, 'SUCCESS', profile, origin);
}

export async function handleUpdateProfile(request: Request, env: Env, origin: string, userId: string): Promise<Response> {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return errorResponse(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ', origin);

  const now = Date.now();
  const displayName = body.display_name ? String(body.display_name).trim() : 'Bé thông minh';
  const avatarUrl = body.avatar_url ? String(body.avatar_url).trim() : null;
  const gradeLevel = body.grade_level ? String(body.grade_level).trim() : 'grade_1';
  const birthYear = typeof body.birth_year === 'number' ? body.birth_year : null;

  await env.DB.prepare(`
    INSERT INTO profiles (user_id, display_name, avatar_url, grade_level, birth_year, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      display_name = excluded.display_name,
      avatar_url = excluded.avatar_url,
      grade_level = excluded.grade_level,
      birth_year = excluded.birth_year,
      updated_at = excluded.updated_at
  `).bind(userId, displayName, avatarUrl, gradeLevel, birthYear, now, now).run();

  const profile = await env.DB.prepare('SELECT * FROM profiles WHERE user_id = ?').bind(userId).first();
  return successResponse(200, 'UPDATED', profile, origin);
}
