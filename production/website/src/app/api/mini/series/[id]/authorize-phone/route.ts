import { cleanText, jsonError, toPositiveInt, withDb } from '../../../_helpers';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const routeParams = await params;
    const body = await request.json();
    return withDb((db) => {
      const seriesId = toPositiveInt(routeParams.id);
      const phone = cleanText(body.phone);
      if (!/^1\d{10}$/.test(phone)) return jsonError('请输入正确的手机号', 400);
      let member = db.prepare('SELECT id, phone, name FROM Member WHERE phone=?').get(phone);
      let created = false;
      if (!member) {
        const result = db.prepare(`INSERT INTO Member (name, phone, source, status, register_date, created_at) VALUES (?, ?, 'phone_auth', 'active', date('now','localtime'), datetime('now','localtime'))`).run(`手机学员${phone.slice(-4)}`, phone);
        member = db.prepare('SELECT id, phone, name FROM Member WHERE id=?').get(result.lastInsertRowid);
        created = true;
      }
      db.prepare("DELETE FROM CourseAuthorization WHERE series_id=? AND type='phone_grant' AND (phone=? OR member_id=?)").run(seriesId, phone, member.id);
      db.prepare(`INSERT INTO CourseAuthorization (member_id, phone, series_id, type, granted_at, status) VALUES (?, ?, ?, 'phone_grant', datetime('now','localtime'), 'active')`).run(member.id, phone, seriesId);
      return Response.json({ success: true, data: { member, created } });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
