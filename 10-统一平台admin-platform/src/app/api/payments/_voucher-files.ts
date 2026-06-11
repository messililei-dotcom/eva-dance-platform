import { unlink } from 'fs/promises';
import path from 'path';

export const PAYMENT_VOUCHER_UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'payments');
export const PAYMENT_VOUCHER_URL_PREFIX = '/uploads/payments/';

export function safeVoucherName(value: unknown) {
  return String(value || '')
    .trim()
    .replace(/[\\/:*?"<>|#%&{}$!'@+=`~\s]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || '未命名';
}

export function paymentVoucherDiskPath(voucherPath: unknown) {
  const text = String(voucherPath || '');
  if (!text.startsWith(PAYMENT_VOUCHER_URL_PREFIX)) return '';
  const filename = path.basename(decodeURIComponent(text.slice(PAYMENT_VOUCHER_URL_PREFIX.length)));
  if (!filename) return '';
  return path.join(PAYMENT_VOUCHER_UPLOAD_DIR, filename);
}

export async function deletePaymentVoucherFile(voucherPath: unknown) {
  const diskPath = paymentVoucherDiskPath(voucherPath);
  if (!diskPath) return;
  await unlink(diskPath).catch(() => {});
}
