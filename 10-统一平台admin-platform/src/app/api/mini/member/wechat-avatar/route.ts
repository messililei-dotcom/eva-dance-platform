import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { getMemberId, jsonError, withDb } from '../../_helpers';

export const runtime = 'nodejs';

const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'wechat-avatar');
const MIME_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export async function POST(request: Request) {
  try {
    const memberId = getMemberId(new URL(request.url).searchParams, request);
    if (!memberId) return jsonError('未登录', 401);

    const form = await request.formData();
    const avatar = form.get('avatar');
    if (!(avatar instanceof File)) return jsonError('请上传头像文件', 400);
    if (!MIME_EXTENSION[avatar.type]) return jsonError('仅支持 JPG、PNG 或 WebP 头像', 400);
    if (avatar.size > MAX_AVATAR_SIZE) return jsonError('头像文件不能超过 2MB', 400);

    return withDb(async (db) => {
      const member = db.prepare('SELECT id FROM Member WHERE id=?').get(memberId);
      if (!member) return jsonError('学员不存在', 404);

      await mkdir(UPLOAD_DIR, { recursive: true });
      const extension = MIME_EXTENSION[avatar.type];
      const filename = `${memberId}-${Date.now()}-${randomUUID()}.${extension}`;
      const filePath = path.join(UPLOAD_DIR, filename);
      const buffer = Buffer.from(await avatar.arrayBuffer());
      await writeFile(filePath, buffer);

      const avatarUrl = `/uploads/wechat-avatar/${filename}`;
      db.prepare(
        `UPDATE Member
         SET wx_avatar_url=?, wx_profile_synced_at=datetime('now','localtime')
         WHERE id=?`
      ).run(avatarUrl, memberId);

      return Response.json({
        success: true,
        data: {
          avatar_url: avatarUrl,
          wx_avatar_url: avatarUrl,
        },
      });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
