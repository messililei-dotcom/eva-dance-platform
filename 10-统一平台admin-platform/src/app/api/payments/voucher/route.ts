import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { compressVoucherImage } from '@/lib/server/voucher-image';
import { randomUUID } from 'crypto';
import { cleanText, hasAuth, jsonError, nowIso, unauthorized } from '../../training-db';
import {
  PAYMENT_VOUCHER_UPLOAD_DIR,
  PAYMENT_VOUCHER_URL_PREFIX,
  deletePaymentVoucherFile,
  safeVoucherName,
} from '../_voucher-files';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_VOUCHER_SIZE = 12 * 1024 * 1024;
export async function POST(request: Request) {
  if (!hasAuth(request)) return unauthorized();

  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return Response.json({ success: false, error: '请选择付款凭证图片' }, { status: 400 });
    if (!file.type.startsWith('image/')) return Response.json({ success: false, error: '付款凭证仅支持图片文件' }, { status: 400 });
    if (file.size > MAX_VOUCHER_SIZE) return Response.json({ success: false, error: '付款凭证图片不能超过 12MB' }, { status: 400 });

    const date = cleanText(form.get('date'));
    const memberName = cleanText(form.get('memberName'));
    const courseName = cleanText(form.get('courseName'));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !memberName || !courseName) {
      return Response.json({ success: false, error: '请先选择缴费日期、学员和课程' }, { status: 400 });
    }

    const buffer = await compressVoucherImage(Buffer.from(await file.arrayBuffer()));

    await mkdir(PAYMENT_VOUCHER_UPLOAD_DIR, { recursive: true });
    const filename = `${date}_${safeVoucherName(memberName)}_${safeVoucherName(courseName)}_${Date.now()}_${randomUUID()}.webp`;
    const diskPath = path.join(PAYMENT_VOUCHER_UPLOAD_DIR, filename);
    await writeFile(diskPath, buffer);

    const oldPath = cleanText(form.get('oldPath'));
    if (oldPath) await deletePaymentVoucherFile(oldPath);

    const voucherPath = `${PAYMENT_VOUCHER_URL_PREFIX}${encodeURIComponent(filename)}`;
    return Response.json({
      success: true,
      data: {
        voucherPath,
        voucherFilename: filename,
        voucherUploadedAt: nowIso(),
        originalSize: file.size,
        storedSize: buffer.length,
      },
    });
  } catch (err: any) {
    return jsonError(err?.message, 500, '上传付款凭证失败');
  }
}
