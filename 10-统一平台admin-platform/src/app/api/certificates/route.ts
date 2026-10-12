import { openAdminDb } from '@/lib/server/admin-db';
import { hasAuth, unauthorized } from '../training-db';
import {
  certificateNo,
  certificatePublicUrl,
  certificateVerifyUrl,
  ensureCertificateSchema,
  ensureTemplateForSeries,
} from '@/lib/server/certificates';
import { createPersonalMessage } from '@/lib/server/inbox';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();

  const search = new URL(request.url).searchParams;
  const memberId = Number(search.get('memberId') || search.get('member_id') || 0);
  const db = openAdminDb();

  try {
    ensureCertificateSchema(db);
    const where = memberId ? 'WHERE c.member_id = ?' : '';
    const params = memberId ? [memberId] : [];
    const rows = db.prepare(`
      SELECT
        c.id,
        c.certificate_no,
        c.series_id,
        c.member_id,
        c.issue_date,
        c.pdf_url,
        c.status,
        c.source_platform,
        c.issue_method,
        c.verify_url,
        c.completion_rate,
        c.template_id,
        c.remark,
        c.created_at,
        COALESCE(NULLIF(c.recipient_name, ''), m.name, '') AS member_name,
        COALESCE(NULLIF(cs.name, ''), NULLIF(tc.name, ''), '') AS course_name
      FROM Certificate c
      LEFT JOIN Member m ON m.id = c.member_id
      LEFT JOIN CourseSeries cs ON cs.id = c.series_id
      LEFT JOIN Course tc ON c.series_id < 0 AND tc.id = ABS(c.series_id)
      ${where}
      ORDER BY datetime(c.issue_date) DESC, c.id DESC
    `).all(...params);

    return Response.json(rows.map((row: any) => ({
      id: row.id,
      certificateNo: row.certificate_no,
      certNo: row.certificate_no,
      certificate_no: row.certificate_no,
      seriesId: row.series_id,
      series_id: row.series_id,
      memberId: row.member_id,
      member_id: row.member_id,
      memberName: row.member_name,
      member_name: row.member_name,
      courseName: row.course_name,
      course_name: row.course_name,
      name: row.course_name ? `${row.course_name} - ${row.member_name}` : row.member_name,
      issueDate: String(row.issue_date || '').slice(0, 10),
      issue_date: row.issue_date,
      pdfUrl: row.pdf_url || certificatePublicUrl(row.id, row.certificate_no),
      pdf_url: row.pdf_url || certificatePublicUrl(row.id, row.certificate_no),
      status: row.status || 'active',
      sourcePlatform: row.source_platform || 'admin',
      source_platform: row.source_platform || 'admin',
      issueMethod: row.issue_method || 'manual',
      issue_method: row.issue_method || 'manual',
      verifyUrl: row.verify_url || certificateVerifyUrl(row.certificate_no),
      verify_url: row.verify_url || certificateVerifyUrl(row.certificate_no),
      completionRate: Number(row.completion_rate || 0),
      completion_rate: Number(row.completion_rate || 0),
      templateId: row.template_id || 0,
      template_id: row.template_id || 0,
      remark: row.remark || '',
      created_at: row.created_at,
    })));
  } finally {
    db.close();
  }
}

export async function POST(request: Request) {
  if (!hasAuth(request)) return unauthorized();

  const body = await request.json().catch(() => ({}));
  const memberId = Number(body.member_id ?? body.memberId ?? 0);
  const seriesId = Number(body.series_id ?? body.seriesId ?? 0);
  const issueMethod = String(body.issue_method || body.issueMethod || 'manual');
  const sourcePlatform = String(body.source_platform || body.sourcePlatform || 'admin');
  const remark = String(body.remark || '');

  if (!memberId || !seriesId) {
    return Response.json({ success: false, error: '请选择学员和课程系列' }, { status: 400 });
  }

  const db = openAdminDb();
  try {
    ensureCertificateSchema(db);
    const existing = db.prepare(`
      SELECT id, certificate_no
      FROM Certificate
      WHERE member_id = ? AND series_id = ? AND status = 'active'
    `).get(memberId, seriesId);

    if (existing) {
      return Response.json({ success: false, error: '该学员已获得此课程证书', data: existing }, { status: 409 });
    }

    const course = seriesId < 0
      ? db.prepare('SELECT name FROM Course WHERE id = ?').get(Math.abs(seriesId)) as { name?: string } | undefined
      : db.prepare('SELECT name FROM CourseSeries WHERE id = ?').get(seriesId) as { name?: string } | undefined;
    const template = await ensureTemplateForSeries(db, seriesId, course?.name || '');
    const nextCertificateNo = certificateNo(memberId, seriesId);
    const result = db.prepare(`
      INSERT INTO Certificate (
        certificate_no, series_id, member_id, issue_date, pdf_url, status,
        source_platform, issue_method, verify_code, verify_url, completion_rate,
        template_id, remark, updated_at
      )
      VALUES (?, ?, ?, datetime('now','localtime'), '', 'active', ?, ?, ?, ?, 100, ?, ?, datetime('now','localtime'))
    `).run(
      nextCertificateNo,
      seriesId,
      memberId,
      sourcePlatform,
      issueMethod,
      nextCertificateNo,
      certificateVerifyUrl(nextCertificateNo),
      template.id || 0,
      remark,
    );

    const pdfUrl = certificatePublicUrl(result.lastInsertRowid, nextCertificateNo);
    db.prepare('UPDATE Certificate SET pdf_url = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(pdfUrl, result.lastInsertRowid);
    createPersonalMessage(db, memberId, {
      type: 'certificate',
      title: '结业证书已生成',
      content: `你的《${course?.name || '课程'}》结业证书已经生成，可以在个人中心查看。`,
      actionUrl: '/dashboard/profile#certificates',
      businessType: 'certificate',
      businessId: result.lastInsertRowid,
      dedupeKey: `certificate:${result.lastInsertRowid}`,
      priority: 'important',
      payload: { certificateNo: nextCertificateNo, pdfUrl, seriesId },
    });

    return Response.json({
      success: true,
      data: {
        id: result.lastInsertRowid,
        certificateNo: nextCertificateNo,
        certificate_no: nextCertificateNo,
        pdfUrl,
        pdf_url: pdfUrl,
      },
    });
  } finally {
    db.close();
  }
}

export async function DELETE(request: Request) {
  if (!hasAuth(request)) return unauthorized();

  const id = Number(new URL(request.url).searchParams.get('id') || 0);
  if (!id) return Response.json({ success: false, error: '缺少证书ID' }, { status: 400 });

  const db = openAdminDb();
  try {
    ensureCertificateSchema(db);
    const result = db.prepare("UPDATE Certificate SET status = 'revoked' WHERE id = ?").run(id);
    if (!result.changes) {
      return Response.json({ success: false, error: '证书不存在' }, { status: 404 });
    }
    return Response.json({ success: true, data: { id } });
  } finally {
    db.close();
  }
}
