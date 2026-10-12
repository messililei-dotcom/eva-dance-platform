import { hasAuth, unauthorized, withRequestEventDb } from '../_db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  return withRequestEventDb(request, (db) => {
    const url = new URL(request.url);
    const keyword = (url.searchParams.get('keyword') || '').trim();
    if (url.searchParams.get('matchFor') === 'registration') {
      if (keyword.length < 2) return Response.json({ success: true, data: [] });
      const rows = db.prepare(`SELECT id,name,phone FROM main.Member WHERE COALESCE(status,'active')!='deleted' AND (instr(name,?)>0 OR instr(phone,?)>0) ORDER BY id DESC LIMIT 20`).all(keyword,keyword);
      return Response.json({ success: true, data: rows });
    }
    const rows = db.prepare(`
      SELECT id, name, phone, city, remark, source,
             wx_openid, wx_unionid, wx_name, wx_account, wx_nickname
      FROM Member
      WHERE COALESCE(status, 'active')!='deleted'
      ORDER BY name COLLATE NOCASE, id
    `).all();
    return Response.json({ success: true, data: rows });
  });
}
