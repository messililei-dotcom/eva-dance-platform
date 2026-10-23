import { cleanText, getAuthenticatedMemberId, getMemberId, jsonError, withDb } from '../../_helpers';

export async function GET(request: Request) {
  try {
    return withDb((db) => {
      const memberId = getMemberId(new URL(request.url).searchParams, request);
      if (!memberId) return jsonError('未登录', 401);
      const member = db.prepare(
        `SELECT id, name, phone, gender, birthday, country, province, city, address, remark,
                register_date, created_at, COALESCE(wx_avatar_url, '') as avatar_url, level,
                COALESCE(wx_openid, '') AS wx_openid,
                COALESCE(wx_unionid, '') AS wx_unionid,
                COALESCE(wx_nickname, '') AS wx_nickname,
                COALESCE(wx_name, '') AS wx_name,
                COALESCE(wx_account, '') AS wx_account,
                COALESCE(wx_avatar_url, '') AS wx_avatar_url,
                COALESCE(wx_profile_synced_at, '') AS wx_profile_synced_at,
                CASE WHEN COALESCE(wx_openid,'')<>'' OR COALESCE(wx_unionid,'')<>'' THEN 1 ELSE 0 END AS is_wechat_bound
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
      const memberId = getAuthenticatedMemberId(request);
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
                register_date, created_at, COALESCE(wx_avatar_url, '') as avatar_url, level,
                COALESCE(wx_openid, '') AS wx_openid,
                COALESCE(wx_unionid, '') AS wx_unionid,
                COALESCE(wx_nickname, '') AS wx_nickname,
                COALESCE(wx_name, '') AS wx_name,
                COALESCE(wx_account, '') AS wx_account,
                COALESCE(wx_avatar_url, '') AS wx_avatar_url,
                COALESCE(wx_profile_synced_at, '') AS wx_profile_synced_at,
                CASE WHEN COALESCE(wx_openid,'')<>'' OR COALESCE(wx_unionid,'')<>'' THEN 1 ELSE 0 END AS is_wechat_bound
         FROM Member WHERE id=?`
      ).get(memberId);
      return Response.json({ success: true, data: member });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
