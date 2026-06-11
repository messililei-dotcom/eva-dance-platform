import { cleanText, getMemberId, jsonError, withDb } from '../../_helpers';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return withDb((db) => {
      const memberId = getMemberId(new URL(request.url).searchParams, request);
      if (!memberId) return jsonError('未登录', 401);
      const member = db.prepare('SELECT id FROM Member WHERE id=?').get(memberId);
      if (!member) return jsonError('学员不存在', 404);
      const nickname = cleanText(body.nickname).slice(0, 30);
      const avatarUrl = cleanText(body.avatar_url).slice(0, 500);
      if (!nickname && !avatarUrl) return jsonError('请先选择头像或填写昵称', 400);
      db.prepare(
        `UPDATE Member
         SET wx_nickname=?,
             wx_avatar_url=?,
             name=CASE WHEN name LIKE '微信学员%' AND ?<>'' THEN ? ELSE name END,
             wx_profile_synced_at=datetime('now','localtime')
         WHERE id=?`
      ).run(nickname, avatarUrl, nickname, nickname, memberId);
      const updated = db.prepare(
        `SELECT id, name, phone, wx_nickname, wx_avatar_url, wx_openid, wx_unionid, wx_profile_synced_at, level
         FROM Member WHERE id=?`
      ).get(memberId);
      return Response.json({ success: true, data: updated });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
