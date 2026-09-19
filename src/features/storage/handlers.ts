import { createPresignedPutUrl } from '../../utils/r2-presign.ts';
import { errorResponse, successResponse } from '../../utils/response.ts';
import { generateUUIDv7 } from '../../utils/uuid.ts';

export function getFileExtension(contentType: string): string {
  const clean = contentType.toLowerCase().trim();
  if (clean.includes('avif')) return 'avif';
  if (clean.includes('webp')) return 'webp';
  if (clean.includes('png')) return 'png';
  if (clean.includes('svg')) return 'svg';
  if (clean.includes('jpeg') || clean.includes('jpg')) return 'jpg';
  if (clean.includes('gif')) return 'gif';
  if (clean.includes('opus')) return 'opus';
  if (clean.includes('ogg')) return 'ogg';
  if (clean.includes('mp3')) return 'mp3';
  if (clean.includes('mp4')) return 'mp4';
  if (clean.includes('webm')) return 'webm';
  return 'bin';
}

/**
 * Tạo presigned URL để client upload trực tiếp lên math-bucket (r2)
 * Đối với Math Kids, lưu vào thư mục: kids/<category>/<fileId>.<ext>
 * Ví dụ category: courses, lessons, roadmaps, assets...
 */
export async function handleCreateUploadPresign(
  request: Request,
  env: Env,
  origin: string
): Promise<Response> {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || !body.content_type) {
    return errorResponse(400, 'VALIDATION_ERROR', 'content_type là bắt buộc', origin);
  }

  const contentType = String(body.content_type).trim();
  const subFolder = body.folder ? String(body.folder).replace(/^\/+|\/+$/g, '') : 'assets';
  const fileId = body.file_id ? String(body.file_id).trim() : generateUUIDv7();
  const ext = body.extension ? String(body.extension).replace(/^\./, '') : getFileExtension(contentType);

  // Tất cả tài nguyên thuộc toán kids lưu dưới prefix kids/
  const key = `kids/${subFolder}/${fileId}.${ext}`;

  if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
    return errorResponse(500, 'INTERNAL_ERROR', 'R2 credentials chưa được cấu hình', origin);
  }

  try {
    const signed = await createPresignedPutUrl(key, contentType, {
      accountId: env.R2_ACCOUNT_ID,
      bucket: 'math-bucket',
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    });

    const publicUrl = `${env.ASSET_BASE_URL.replace(/\/+$/, '')}/${key}`;

    return successResponse(200, 'SUCCESS', {
      key,
      url: publicUrl,
      content_type: contentType,
      upload_url: signed.uploadUrl,
      expires_in: signed.expiresIn,
    }, origin);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(500, 'INTERNAL_ERROR', message, origin);
  }
}

/**
 * Xoá file trong math-bucket (nếu có URL hoặc key)
 */
export async function handleDeleteStorageAsset(
  request: Request,
  env: Env,
  origin: string
): Promise<Response> {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const rawKeyOrUrl = body?.key || body?.url;
  if (!rawKeyOrUrl) {
    return errorResponse(400, 'VALIDATION_ERROR', 'key hoặc url là bắt buộc', origin);
  }

  let key = String(rawKeyOrUrl).trim();
  const baseUrl = env.ASSET_BASE_URL.replace(/\/+$/, '');
  if (key.startsWith(baseUrl)) {
    key = key.slice(baseUrl.length).replace(/^\/+/, '');
  }

  if (!env.ASSETS) {
    return errorResponse(500, 'INTERNAL_ERROR', 'R2 ASSETS binding chưa sẵn sàng', origin);
  }

  try {
    await env.ASSETS.delete(key);
    return successResponse(200, 'DELETED', { key }, origin);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(500, 'INTERNAL_ERROR', message, origin);
  }
}
