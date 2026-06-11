import { cleanText, getMemberId, jsonError, withDb } from '../../_helpers';

export async function GET(request: Request) {
  try {
    return withDb((db) => {
      const memberId = getMemberId(new URL(request.url).searchParams, request);
      if (!memberId) return jsonError('未登录', 401);
      const member = db.prepare(
        `SELECT id, name, phone, gender, birthday, country, province, city, address, remark,
                register_date, created_at, COALESCE(wx_avatar_url, '') as avatar_url,
                wx_avatar_url, wx_nickname, wx_openid, wx_unionid, wx_profile_synced_at, level
         FROM Member WHERE id=?`
      ).get(memberId);
      if (!member) return jsonError('学员不存在', 404);
      return Response.json({ success: true, data: member });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    return withDb((db) => {
      const memberId = getMemberId(new URL(request.url).searchParams, request);
      if (!memberId) return jsonError('未登录', 401);
      const name = cleanText(body.name);
      if (!name) return jsonError('姓名不能为空', 400);

      db.prepare(`
        UPDATE Member
        SET name=?, gender=?, birthday=?, country=?, province=?, city=?, address=?, remark=?
        WHERE id=?
      `).run(
        name,
        cleanText(body.gender, '女'),
        cleanText(body.birthday),
        cleanText(body.country, '中国'),
        cleanText(body.province),
        cleanText(body.city),
        cleanText(body.address),
        cleanText(body.remark),
        memberId,
      );

      const member = db.prepare(
        `SELECT id, name, phone, gender, birthday, country, province, city, address, remark,
                register_date, created_at, COALESCE(wx_avatar_url, '') as avatar_url,
                wx_avatar_url, wx_nickname, wx_openid, wx_unionid, wx_profile_synced_at, level
         FROM Member WHERE id=?`
      ).get(memberId);
      return Response.json({ success: true, data: member });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
