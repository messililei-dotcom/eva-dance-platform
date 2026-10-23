import { removeUnusedAvatars } from '@/lib/server/member-avatar';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { getMemberId, jsonError, toPositiveInt, withDb } from '../../_helpers';

export const runtime = 'nodejs';

const MAX_AVATAR_SIZE = 1024 * 1024;
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'wechat-avatar');
const MIME_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const memberId = getMemberId(new URL(request.url).searchParams, request);
    if (!memberId) return jsonError('未登录', 401);

    const avatar = form.get('avatar');
    if (!(avatar instanceof File)) return jsonError('请上传头像文件', 400);
    if (!MIME_EXTENSION[avatar.type]) return jsonError('仅支持 JPG、PNG 或 WebP 头像', 400);
    if (avatar.size > MAX_AVATAR_SIZE) return jsonError('头像文件不能超过 1M', 400);

    return withDb(async (db) => {
      const member = db.prepare('SELECT id, avatar, wx_avatar_url FROM Member WHERE id=?').get<any>(memberId);
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
         SET avatar=?, wx_avatar_url=?, wx_profile_synced_at=datetime('now','localtime')
         WHERE id=?`
      ).run(avatarUrl, avatarUrl, memberId);
      removeUnusedAvatars(db, [member.avatar, member.wx_avatar_url]);

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
