import {
  hasAuth,
  jsonError,
  openTrainingDb,
  unauthorized,
} from '../../../training-db';
import {
  certificateNo,
  certificatePublicUrl,
  certificateVerifyUrl,
  ensureCertificateSchema,
  ensureTemplateForSeries,
  offlineCertificateSeriesId,
} from '@/lib/server/certificates';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Course = {
  id: number;
  name: string;
  type?: string;
  subType?: string;
  sessions?: number;
  endDate?: string;
};

function courseStudentRows(db: ReturnType<typeof openTrainingDb>, course: Course) {
  const certificateSeriesId = offlineCertificateSeriesId(course.id);
  const rows = db.prepare(`
    WITH students AS (
      SELECT
        p.memberId AS member_id,
        COALESCE(NULLIF(m.name, ''), NULLIF(p.memberName, ''), '') AS member_name,
        COALESCE(NULLIF(m.phone, ''), NULLIF(p.memberPhone, ''), '') AS member_phone,
        COUNT(p.id) AS payment_count,
        COALESCE(SUM(p.amount), 0) AS total_amount,
        MAX(NULLIF(p.expireDate, '')) AS expire_date,
        MAX(COALESCE(p.remainingSessions, 0)) AS remaining_sessions,
        MAX(p.id) AS last_payment_id
      FROM Payment p
      LEFT JOIN Member m ON m.id = p.memberId
      WHERE p.courseId = ? AND COALESCE(p.memberId, 0) > 0
      GROUP BY p.memberId
    ),
    active_certificates AS (
      SELECT *
      FROM Certificate
      WHERE series_id = ? AND status = 'active'
    )
    SELECT
      s.*,
      c.id AS certificate_id,
      c.certificate_no,
      c.issue_date,
      c.pdf_url,
      c.verify_url,
      c.status AS certificate_status
    FROM students s
    LEFT JOIN active_certificates c ON c.member_id = s.member_id
    ORDER BY s.member_name COLLATE NOCASE, s.member_phone
  `).all(course.id, certificateSeriesId) as any[];

  return rows.map((row) => ({
    memberId: Number(row.member_id || 0),
    member_id: Number(row.member_id || 0),
    memberName: row.member_name || '-',
    member_name: row.member_name || '-',
    memberPhone: row.member_phone || '',
    member_phone: row.member_phone || '',
    paymentCount: Number(row.payment_count || 0),
    payment_count: Number(row.payment_count || 0),
    totalAmount: Number(row.total_amount || 0),
    total_amount: Number(row.total_amount || 0),
    expireDate: row.expire_date || course.endDate || '',
    expire_date: row.expire_date || course.endDate || '',
    remainingSessions: Number(row.remaining_sessions || 0),
    remaining_sessions: Number(row.remaining_sessions || 0),
    lastPaymentId: Number(row.last_payment_id || 0),
    last_payment_id: Number(row.last_payment_id || 0),
    certificateId: row.certificate_id ? Number(row.certificate_id) : 0,
    certificate_id: row.certificate_id ? Number(row.certificate_id) : 0,
    certificateNo: row.certificate_no || '',
    certificate_no: row.certificate_no || '',
    issueDate: row.issue_date ? String(row.issue_date).slice(0, 10) : '',
    issue_date: row.issue_date || '',
    pdfUrl: row.certificate_id ? (row.pdf_url || certificatePublicUrl(row.certificate_id, row.certificate_no)) : '',
    pdf_url: row.certificate_id ? (row.pdf_url || certificatePublicUrl(row.certificate_id, row.certificate_no)) : '',
    verifyUrl: row.verify_url || (row.certificate_no ? certificateVerifyUrl(row.certificate_no) : ''),
    verify_url: row.verify_url || (row.certificate_no ? certificateVerifyUrl(row.certificate_no) : ''),
    status: row.certificate_status || '',
    issued: Boolean(row.certificate_id),
  }));
}

function getCourse(db: ReturnType<typeof openTrainingDb>, id: number) {
  return db.prepare('SELECT * FROM Course WHERE id = ?').get(id) as Course | undefined;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();
  const courseId = Number(routeParams.id || 0);
  if (!courseId) return jsonError('缺少课程ID', 400);

  const db = openTrainingDb();
  try {
    ensureCertificateSchema(db);
    const course = getCourse(db, courseId);
    if (!course) return jsonError('课程不存在', 404);

    const students = courseStudentRows(db, course);
    const issued = students.filter((student) => student.issued).length;
    return Response.json({
      success: true,
      data: {
        course: {
          id: course.id,
          name: course.name,
          type: course.type || '',
          subType: course.subType || '',
          certificateSeriesId: offlineCertificateSeriesId(course.id),
          certificate_series_id: offlineCertificateSeriesId(course.id),
        },
        students,
        summary: {
          total: students.length,
          issued,
          pending: students.length - issued,
        },
      },
    });
  } catch (err: any) {
    return jsonError(err?.message || '获取课程证书状态失败');
  } finally {
    db.close();
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();
  const courseId = Number(routeParams.id || 0);
  if (!courseId) return jsonError('缺少课程ID', 400);

  const body = await request.json().catch(() => ({}));
  const rawMemberIds = body.memberIds || body.member_ids;
  const memberIds: number[] = Array.isArray(rawMemberIds)
    ? rawMemberIds.map((id: unknown) => Number(id)).filter((id: number) => Boolean(id))
    : [];
  if (!memberIds.length) return jsonError('请选择要发放证书的学员', 400);

  const db = openTrainingDb();
  try {
    ensureCertificateSchema(db);
    const course = getCourse(db, courseId);
    if (!course) return jsonError('课程不存在', 404);

    const certificateSeriesId = offlineCertificateSeriesId(course.id);
    const students = courseStudentRows(db, course);
    const studentById = new Map(students.map((student) => [Number(student.memberId), student]));
    const targetMemberIds: number[] = Array.from(new Set(memberIds)).filter((id: number) => studentById.has(id));
    if (!targetMemberIds.length) return jsonError('所选学员不在当前课程中', 400);

    const template = await ensureTemplateForSeries(db, certificateSeriesId, course.name || '线下课程');
    const issuedCertificates: any[] = [];
    const skipped: number[] = [];

    const issueSelected = db.transaction((ids: number[]) => {
      ids.forEach((memberId) => {
        const existing = db.prepare(`
          SELECT id, certificate_no
          FROM Certificate
          WHERE member_id = ? AND series_id = ? AND status = 'active'
        `).get(memberId, certificateSeriesId) as any;

        if (existing) {
          skipped.push(memberId);
          return;
        }

        const nextCertificateNo = certificateNo(memberId, certificateSeriesId);
        const result = db.prepare(`
          INSERT INTO Certificate (
            certificate_no, series_id, member_id, issue_date, pdf_url, status,
            source_platform, issue_method, verify_code, verify_url, completion_rate,
            template_id, remark, updated_at
          )
          VALUES (?, ?, ?, datetime('now','localtime'), '', 'active', 'training', 'training_batch', ?, ?, 100, ?, ?, datetime('now','localtime'))
        `).run(
          nextCertificateNo,
          certificateSeriesId,
          memberId,
          nextCertificateNo,
          certificateVerifyUrl(nextCertificateNo),
          template.id || 0,
          `线下课程发放：${course.name || ''}`,
        );

        const pdfUrl = certificatePublicUrl(result.lastInsertRowid, nextCertificateNo);
        db.prepare('UPDATE Certificate SET pdf_url = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?')
          .run(pdfUrl, result.lastInsertRowid);

        issuedCertificates.push({
          id: result.lastInsertRowid,
          memberId,
          member_id: memberId,
          certificateNo: nextCertificateNo,
          certificate_no: nextCertificateNo,
          pdfUrl,
          pdf_url: pdfUrl,
          verifyUrl: certificateVerifyUrl(nextCertificateNo),
          verify_url: certificateVerifyUrl(nextCertificateNo),
        });
      });
    });

    issueSelected(targetMemberIds);

    return Response.json({
      success: true,
      data: {
        issued: issuedCertificates.length,
        skipped: skipped.length,
        requested: targetMemberIds.length,
        certificateSeriesId,
        certificate_series_id: certificateSeriesId,
        certificates: issuedCertificates,
      },
    });
  } catch (err: any) {
    return jsonError(err?.message || '发放证书失败');
  } finally {
    db.close();
  }
}
