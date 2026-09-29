import { hasAuth, unauthorized, withEventDb } from '../_db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  return withEventDb((db) => {
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
