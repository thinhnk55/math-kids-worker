import { errorResponse } from './response.ts';

export type ProfileValidationResult =
  | { ok: true; profileId: number | null }
  | { ok: false; response: Response };

/**
 * Kiểm tra profile_id từ query param (?profile_id=...).
 * - Nếu query param có profile_id:
 *   + Kiểm tra id đó có nằm trong mảng profiles của access token payload hay không.
 *   + Nếu không hợp lệ hoặc không nằm trong profiles: trả về 403 FORBIDDEN.
 *   + Nếu hợp lệ: trả về profileId (dạng number).
 * - Nếu không có query param profile_id:
 *   + Không cần kiểm tra, trả về profileId: null.
 * - Các API phía sau sẽ tin tưởng profileId trả về từ hàm này.
 */
export function validateProfileId(
  request: Request,
  profilesInToken: number[] | undefined,
  origin: string
): ProfileValidationResult {
  const url = new URL(request.url);
  const profileIdParam = url.searchParams.get('profile_id');

  // Nếu không có params gửi lên thì không cần kiểm tra
  if (profileIdParam === null || profileIdParam === '') {
    return { ok: true, profileId: null };
  }

  const numericId = Number.parseInt(profileIdParam, 10);
  if (Number.isNaN(numericId) || numericId <= 0) {
    return {
      ok: false,
      response: errorResponse(400, 'VALIDATION_ERROR', 'ID profile không hợp lệ', origin),
    };
  }

  const allowedProfiles = Array.isArray(profilesInToken) ? profilesInToken : [];
  if (!allowedProfiles.includes(numericId)) {
    return {
      ok: false,
      response: errorResponse(403, 'FORBIDDEN', 'Hồ sơ người học không thuộc quyền quản lý của bạn', origin),
    };
  }

  return { ok: true, profileId: numericId };
}
