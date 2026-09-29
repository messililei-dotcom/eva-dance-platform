import path from 'path';

export const AUTHORIZATION_VOUCHER_UPLOAD_DIR = path.join(
  process.cwd(),
  'public',
  'uploads',
  'online-course-authorization-vouchers',
);
export const AUTHORIZATION_VOUCHER_URL_PREFIX = '/uploads/online-course-authorization-vouchers/';
export const AUTHORIZATION_VOUCHER_VIEW_URL_PREFIX = '/api/course/authorization-vouchers/';
export const MAX_AUTHORIZATION_VOUCHERS = 12;

export type AuthorizationVoucher = {
  voucherPath: string;
  voucherFilename: string;
  originalName?: string;
  uploadedAt?: string;
};

export function safeAuthorizationVoucherName(value: unknown) {
  return String(value || '')
    .trim()
    .replace(/[\\/:*?"<>|#%&{}$!'@+=`~\s]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || '未命名';
}

export function authorizationVoucherFilename(value: unknown) {
  const voucherPath = String(value || '').trim();
  const prefix = [AUTHORIZATION_VOUCHER_URL_PREFIX, AUTHORIZATION_VOUCHER_VIEW_URL_PREFIX]
    .find(candidate => voucherPath.startsWith(candidate));
  if (!prefix) return '';

  try {
    const decoded = decodeURIComponent(voucherPath.slice(prefix.length));
    const filename = path.basename(decoded);
    if (!filename || filename !== decoded || !filename.toLowerCase().endsWith('.webp')) return '';
    return filename;
  } catch {
    return '';
  }
}

export function authorizationVoucherDiskPath(value: unknown) {
  const filename = authorizationVoucherFilename(value);
  return filename ? path.join(AUTHORIZATION_VOUCHER_UPLOAD_DIR, filename) : '';
}

export function authorizationVoucherViewPath(value: unknown) {
  const filename = authorizationVoucherFilename(value);
  return filename ? `${AUTHORIZATION_VOUCHER_VIEW_URL_PREFIX}${encodeURIComponent(filename)}` : '';
}

export function normalizeAuthorizationVouchers(value: unknown): AuthorizationVoucher[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_AUTHORIZATION_VOUCHERS).flatMap((item) => {
    const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    const voucherPath = authorizationVoucherViewPath(row.voucherPath || row.url);
    if (!voucherPath) return [];
    return [{
      voucherPath,
      voucherFilename: String(row.voucherFilename || authorizationVoucherFilename(voucherPath)).trim(),
      originalName: String(row.originalName || '').trim(),
      uploadedAt: String(row.uploadedAt || '').trim(),
    }];
  });
}

export function parseAuthorizationVouchers(value: unknown): AuthorizationVoucher[] {
  if (Array.isArray(value)) return normalizeAuthorizationVouchers(value);
  try {
    return normalizeAuthorizationVouchers(JSON.parse(String(value || '[]')));
  } catch {
    return [];
  }
}
