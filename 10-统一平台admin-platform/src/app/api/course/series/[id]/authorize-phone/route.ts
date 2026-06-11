import { cleanText, jsonError, toPositiveInt, withDb } from '../../../_materials';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  const body = await request.json().catch(() => ({}));
  try {
    return withDb((db) => {
      const seriesId = toPositiveInt(routeParams.id);
      const phone = cleanText(body.phone);
      if (!seriesId) return jsonError('课程不存在', 404);
      if (!/^1\d{10}$/.test(phone)) return jsonError('请输入正确的手机号', 400);

      const series = db.prepare('SELECT id FROM CourseSeries WHERE id=?').get(seriesId);
      if (!series) return jsonError('课程不存在', 404);

      let member = db.prepare('SELECT id, phone, name FROM Member WHERE phone=?').get(phone) as any;
      let created = false;
      if (!member) {
        const result = db.prepare(
          `INSERT INTO Member (name, phone, source, status, register_date, created_at)
           VALUES (?, ?, 'phone_auth', 'active', date('now','localtime'), datetime('now','localtime'))`
        ).run(`手机学员${phone.slice(-4)}`, phone);
        member = db.prepare('SELECT id, phone, name FROM Member WHERE id=?').get(result.lastInsertRowid);
        created = true;
      }

      db.prepare("DELETE FROM CourseAuthorization WHERE series_id=? AND type='phone_grant' AND (phone=? OR member_id=?)").run(seriesId, phone, member.id);
      db.prepare(
        `INSERT INTO CourseAuthorization (member_id, phone, series_id, type, granted_at, status, remark)
         VALUES (?, ?, ?, 'phone_grant', datetime('now','localtime'), 'active', ?)`
      ).run(member.id, phone, seriesId, cleanText(body.remark));
      return Response.json({ success: true, data: { member, created } });
    });
  } catch (err: any) {
    return jsonError(err?.message || '手机号授权失败');
  }
}
