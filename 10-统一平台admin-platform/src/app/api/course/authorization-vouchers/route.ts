import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { compressVoucherImage } from '@/lib/server/voucher-image';
import { randomUUID } from 'crypto';
import { cleanText, jsonError, nowIso, requirePermission } from '../../training-db';
import {
  AUTHORIZATION_VOUCHER_UPLOAD_DIR,
  AUTHORIZATION_VOUCHER_VIEW_URL_PREFIX,
  safeAuthorizationVoucherName,
} from '@/lib/server/authorization-vouchers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_VOUCHER_SIZE = 12 * 1024 * 1024;
export async function POST(request: Request) {
  const permissionError = requirePermission(request, 'permOnlineAuthCreate');
  if (permissionError) return permissionError;

  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return jsonError('请选择订单凭证图片', 400);
    if (!file.type.startsWith('image/')) return jsonError('订单凭证仅支持图片文件', 400);
    if (file.size > MAX_VOUCHER_SIZE) return jsonError('单张订单凭证不能超过 12MB', 400);

    const subject = safeAuthorizationVoucherName(cleanText(form.get('subject')));
    const course = safeAuthorizationVoucherName(cleanText(form.get('course')));
    const group = safeAuthorizationVoucherName(cleanText(form.get('group'))).slice(0, 32);
    const sequence = Math.max(1, Number.parseInt(cleanText(form.get('sequence')) || '1', 10) || 1);
    const now = new Date();
    const timestamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
      '-',
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0'),
    ].join('');
    const filename = `${timestamp}_${subject}_${course}_${group}_${String(sequence).padStart(2, '0')}_${randomUUID()}.webp`;
    await mkdir(AUTHORIZATION_VOUCHER_UPLOAD_DIR, { recursive: true });
    const originalBuffer = Buffer.from(await file.arrayBuffer());
    const compressedBuffer = await compressVoucherImage(originalBuffer);
    await writeFile(path.join(AUTHORIZATION_VOUCHER_UPLOAD_DIR, filename), compressedBuffer);

    return Response.json({
      success: true,
      data: {
        voucherPath: `${AUTHORIZATION_VOUCHER_VIEW_URL_PREFIX}${encodeURIComponent(filename)}`,
        voucherFilename: filename,
        originalName: file.name,
        uploadedAt: nowIso(),
        originalSize: file.size,
        storedSize: compressedBuffer.length,
      },
    });
  } catch (err: any) {
    return jsonError(err?.message, 500, '上传订单凭证失败');
  }
}
