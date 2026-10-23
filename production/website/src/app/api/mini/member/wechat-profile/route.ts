import { removeUnusedAvatars } from '@/lib/server/member-avatar';
import { cleanText, getAuthenticatedMemberId, jsonError, withDb } from '../../_helpers';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return withDb((db) => {
      const memberId = getAuthenticatedMemberId(request);
      if (!memberId) return jsonError('未登录', 401);
      const member = db.prepare('SELECT id, avatar, wx_avatar_url FROM Member WHERE id=?').get<any>(memberId);
      if (!member) return jsonError('学员不存在', 404);
      const avatar = cleanText(body.avatar_url).slice(0, 500) || member.wx_avatar_url || member.avatar || '';
      db.prepare(
        `UPDATE Member
         SET wx_nickname=?, avatar=?, wx_avatar_url=?, wx_profile_synced_at=datetime('now','localtime')
         WHERE id=?`
      ).run(cleanText(body.nickname).slice(0, 30), avatar, avatar, memberId);
      removeUnusedAvatars(db, [member.avatar, member.wx_avatar_url]);
      return Response.json({ success: true });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
