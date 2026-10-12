import { getMemberId, jsonError, linkedMemberIds, sqlIn, withDb } from '../_helpers';
import { certificatePublicUrl, certificateVerifyUrl, ensureCertificateSchema } from '@/lib/server/certificates';

export async function GET(request: Request) {
  try {
    return withDb((db) => {
      ensureCertificateSchema(db);
      const memberId = getMemberId(new URL(request.url).searchParams, request);
      if (!memberId) return jsonError('未登录', 401);
      const linked = sqlIn(linkedMemberIds(db, memberId));

      const rows = db.prepare(`
        SELECT
          c.id,
          c.certificate_no,
          c.series_id,
          c.member_id,
          c.issue_date,
          c.pdf_url,
          c.status,
          c.verify_url,
          c.completion_rate,
          c.issue_method,
          c.source_platform,
          c.created_at,
          COALESCE(NULLIF(c.recipient_name, ''), m.name, '') AS member_name,
          COALESCE(NULLIF(cs.name, ''), NULLIF(tc.name, ''), '') AS course_name
        FROM Certificate c
        LEFT JOIN Member m ON m.id = c.member_id
        LEFT JOIN CourseSeries cs ON cs.id = c.series_id
        LEFT JOIN Course tc ON c.series_id < 0 AND tc.id = ABS(c.series_id)
        WHERE c.member_id IN (${linked.clause})
        ORDER BY datetime(c.issue_date) DESC, c.id DESC
      `).all(...linked.values);

      return Response.json({
        success: true,
        data: rows.map((row: any) => ({
          id: row.id,
          certificateNo: row.certificate_no,
          certificate_no: row.certificate_no,
          seriesId: row.series_id,
          series_id: row.series_id,
          memberId: row.member_id,
          member_id: row.member_id,
          memberName: row.member_name,
          member_name: row.member_name,
          courseName: row.course_name,
          course_name: row.course_name,
          issueDate: String(row.issue_date || '').slice(0, 10),
          issue_date: row.issue_date,
          pdfUrl: row.pdf_url || certificatePublicUrl(row.id, row.certificate_no),
          pdf_url: row.pdf_url || certificatePublicUrl(row.id, row.certificate_no),
          verifyUrl: row.verify_url || certificateVerifyUrl(row.certificate_no),
          verify_url: row.verify_url || certificateVerifyUrl(row.certificate_no),
          completionRate: Number(row.completion_rate || 0),
          completion_rate: Number(row.completion_rate || 0),
          issueMethod: row.issue_method || 'manual',
          issue_method: row.issue_method || 'manual',
          sourcePlatform: row.source_platform || 'admin',
          source_platform: row.source_platform || 'admin',
          status: row.status || 'active',
          created_at: row.created_at,
        })),
      });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
