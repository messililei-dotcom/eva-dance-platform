import { getMemberId, jsonError, linkedMemberIds, sqlIn, withDb } from '../../../_helpers';
import { ensureCertificateSchema, getTemplateForSeries } from '@/lib/server/certificates';
import { renderCertificatePng } from '@/lib/server/certificate-preview';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const memberId = getMemberId(new URL(request.url).searchParams, request);
  if (!memberId) return jsonError('请先登录学员账号', 401);
  const { id } = await params;
  if (!/^[1-9]\d*$/.test(id)) return jsonError('证书不存在', 404);
  const body = await request.json().catch(() => null);
  if (typeof body?.name !== 'string' || typeof body?.previousName !== 'string') return jsonError('请填写证书姓名', 400);
  const name = body.name.normalize('NFC').trim();
  if (!name || Array.from(name).length > 40 || /[\p{Cc}\p{Cf}<>]/u.test(name)) return jsonError('姓名须为 1–40 个字符，不能包含换行或特殊控制字符', 400);
  try {
    return await withDb(async db => {
      ensureCertificateSchema(db);
      const linked = sqlIn(linkedMemberIds(db, memberId));
      const query = `SELECT c.*, COALESCE(NULLIF(c.recipient_name, ''), m.name, '') AS member_name,
        COALESCE(NULLIF(cs.name, ''), NULLIF(tc.name, ''), '') AS course_name FROM Certificate c
        LEFT JOIN Member m ON m.id=c.member_id LEFT JOIN CourseSeries cs ON cs.id=c.series_id
        LEFT JOIN Course tc ON c.series_id<0 AND tc.id=ABS(c.series_id)
        WHERE c.id=? AND c.status='active' AND c.member_id IN (${linked.clause})`;
      const read = () => db.prepare(query).get<any>(Number(id), ...linked.values);
      const record = read();
      if (!record) return jsonError('证书不存在、已撤销或不属于当前账号', 404);
      if (record.member_name !== body.previousName) return jsonError('证书姓名已更新，请刷新后重新编辑', 409);
      // Verify regeneration before saving; a rendering failure leaves the record intact.
      await renderCertificatePng({ ...record, member_name: name }, getTemplateForSeries(db, record.series_id));
      const saved = db.transaction(() => {
        const latest = read();
        if (!latest || latest.member_name !== body.previousName) return false;
        if (latest.member_name !== name) {
          db.prepare("UPDATE Certificate SET recipient_name=?, pdf_url='', updated_at=datetime('now','localtime') WHERE id=?").run(name, Number(id));
          db.prepare('INSERT INTO CertificateNameChange(certificate_id,actor_member_id,previous_name,recipient_name) VALUES(?,?,?,?)').run(Number(id), memberId, latest.member_name, name);
        }
        return true;
      })();
      if (!saved) return jsonError('证书已更新，请刷新后重新编辑', 409);
      return Response.json({ success: true, data: { id: Number(id), memberName: name, certificateNo: record.certificate_no } }, { headers: { 'Cache-Control': 'no-store, private' } });
    });
  } catch {
    return jsonError('证书重新生成失败，姓名未保存，请稍后重试', 422);
  }
}
