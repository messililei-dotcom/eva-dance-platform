import { unlink } from 'fs/promises';
import path from 'path';

export const MEMBER_AVATAR_UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'members');
export const MEMBER_AVATAR_URL_PREFIX = '/uploads/members/';

export function safeAvatarName(value: unknown) {
  return String(value || '')
    .trim()
    .replace(/[\\/:*?"<>|#%&{}$!'@+=`~\s]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'member';
}

export function memberAvatarDiskPath(avatarPath: unknown) {
  const text = String(avatarPath || '');
  if (!text.startsWith(MEMBER_AVATAR_URL_PREFIX)) return '';
  const filename = path.basename(decodeURIComponent(text.slice(MEMBER_AVATAR_URL_PREFIX.length)));
  if (!filename) return '';
  return path.join(MEMBER_AVATAR_UPLOAD_DIR, filename);
}

export async function deleteMemberAvatarFile(avatarPath: unknown) {
  const diskPath = memberAvatarDiskPath(avatarPath);
  if (!diskPath) return;
  await unlink(diskPath).catch(() => {});
}
