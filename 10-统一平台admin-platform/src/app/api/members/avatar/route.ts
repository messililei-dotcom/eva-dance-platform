import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { cleanText, hasAuth, jsonError, unauthorized } from '../../training-db';
import {
  deleteMemberAvatarFile,
  MEMBER_AVATAR_UPLOAD_DIR,
  MEMBER_AVATAR_URL_PREFIX,
  safeAvatarName,
} from '../_avatar-files';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const MIME_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function extensionFromFile(file: File) {
  const mimeExtension = MIME_EXTENSION[file.type];
  if (mimeExtension) return mimeExtension;
  const ext = path.extname(file.name || '').replace('.', '').toLowerCase();
  return /^[a-z0-9]{1,8}$/.test(ext) ? ext : '';
}

export async function POST(request: Request) {
  if (!hasAuth(request)) return unauthorized();

  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return Response.json({ success: false, error: '请选择头像图片' }, { status: 400 });
    if (!file.type.startsWith('image/')) return Response.json({ success: false, error: '头像仅支持图片文件' }, { status: 400 });
    if (file.size > MAX_AVATAR_SIZE) return Response.json({ success: false, error: '头像图片不能超过 5MB' }, { status: 400 });

    const extension = extensionFromFile(file);
    if (!extension) return Response.json({ success: false, error: '无法识别图片扩展名' }, { status: 400 });

    await mkdir(MEMBER_AVATAR_UPLOAD_DIR, { recursive: true });
    const memberName = safeAvatarName(form.get('memberName') || 'member');
    const filename = `${memberName}_${Math.floor(Date.now() / 1000)}.${extension}`;
    await writeFile(path.join(MEMBER_AVATAR_UPLOAD_DIR, filename), Buffer.from(await file.arrayBuffer()));

    const oldPath = cleanText(form.get('oldPath'));
    if (oldPath) await deleteMemberAvatarFile(oldPath);

    return Response.json({
      success: true,
      data: {
        avatar: `${MEMBER_AVATAR_URL_PREFIX}${encodeURIComponent(filename)}`,
        filename,
      },
    });
  } catch (err: any) {
    return jsonError(err?.message, 500, '上传头像失败');
  }
}
