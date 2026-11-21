import { hasAuth, jsonError, toNumber, unauthorized, withRequestEventDb } from '../_db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const selectableMember = "COALESCE(status,'active') NOT IN ('deleted','merged') AND COALESCE(merged_to_member_id,0)=0";

export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  return withRequestEventDb(request, (db) => {
    const url = new URL(request.url);
    const keyword = (url.searchParams.get('keyword') || '').trim();
    if (url.searchParams.get('matchFor') === 'judge') {
      const competitionId = toNumber(url.searchParams.get('competitionId'));
      if (!competitionId || !db.prepare('SELECT id FROM event_competitions WHERE id=?').get(competitionId)) {
        return jsonError('赛事不存在或无权限查看', 404);
      }
      if (!keyword || keyword.length > 100) return Response.json({ success: true, data: [] });
      const memberId = Number(keyword.match(/^(?:(?:member|member_id):)?(\d+)$/i)?.[1] || 0);
      if (keyword.length < 2 && !memberId) return Response.json({ success: true, data: [] });
      const rows = db.prepare(`
        SELECT id, name, COALESCE(NULLIF(wx_nickname,''), NULLIF(wx_name,''), wx_account) AS nickname,
          CASE WHEN length(phone)>=7 THEN substr(phone,1,3) || '****' || substr(phone,-4) ELSE '' END AS phone_hint
        FROM main.Member
        WHERE ${selectableMember}
          AND (id=? OR (? >= 2 AND (
            instr(lower(name),lower(?))>0 OR instr(phone,?)>0
            OR instr(lower(wx_nickname),lower(?))>0 OR instr(lower(wx_name),lower(?))>0
            OR instr(lower(wx_account),lower(?))>0
          )))
        ORDER BY (id=?) DESC, (name=? COLLATE NOCASE) DESC, id DESC
        LIMIT 20
      `).all(memberId, keyword.length, keyword, keyword, keyword, keyword, keyword, memberId, keyword);
      return Response.json({ success: true, data: rows }, { headers: { 'Cache-Control': 'private, no-store' } });
    }
    if (url.searchParams.get('matchFor') === 'registration') {
      if (keyword.length < 2) return Response.json({ success: true, data: [] });
      const rows = db.prepare(`SELECT id,name,phone FROM main.Member WHERE ${selectableMember} AND (instr(name,?)>0 OR instr(phone,?)>0) ORDER BY id DESC LIMIT 20`).all(keyword,keyword);
      return Response.json({ success: true, data: rows });
    }
    const rows = db.prepare(`
      SELECT id, name, phone, city, remark, source,
             wx_openid, wx_unionid, wx_name, wx_account, wx_nickname
      FROM Member
      WHERE ${selectableMember}
      ORDER BY name COLLATE NOCASE, id
    `).all();
    return Response.json({ success: true, data: rows });
  });
}
