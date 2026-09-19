export async function resolveProfileId(
  env: Env,
  userId: number,
  requestedProfileId?: string | number | null
): Promise<number | null> {
  if (requestedProfileId !== undefined && requestedProfileId !== null && requestedProfileId !== '') {
    const num = typeof requestedProfileId === 'number' ? requestedProfileId : Number.parseInt(String(requestedProfileId), 10);
    if (!Number.isNaN(num)) {
      const p = await env.DB.prepare('SELECT id FROM profiles WHERE id = ? AND user_id = ?').bind(num, userId).first<{ id: number }>();
      if (p) return p.id;
    }
  }
  const defaultP = await env.DB.prepare('SELECT id FROM profiles WHERE user_id = ? ORDER BY is_default DESC, created_at ASC LIMIT 1')
    .bind(userId).first<{ id: number }>();
  return defaultP?.id ?? null;
}
