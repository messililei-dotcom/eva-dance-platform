import { openAdminDb } from '@/lib/server/admin-db';
import { certificatePublicUrl } from '@/lib/server/certificates';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const no = new URL(request.url).searchParams.get('no') || '';
  if (!no) return Response.json({ success: false, error: '缺少证书编号' }, { status: 400 });

  const db = openAdminDb({ readonly: true });
  try {
    const certificateTable = db.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'Certificate'",
    ).get();
    if (!certificateTable) {
      return Response.json({ success: false, error: '证书查询服务暂不可用' }, { status: 503 });
    }
    const row = db.prepare(`
      SELECT c.id, c.certificate_no, c.issue_date, c.status, c.pdf_url,
             COALESCE(m.name, '') AS member_name,
             COALESCE(NULLIF(cs.name, ''), NULLIF(tc.name, ''), '') AS course_name
      FROM Certificate c
      LEFT JOIN Member m ON m.id = c.member_id
      LEFT JOIN CourseSeries cs ON cs.id = c.series_id
      LEFT JOIN Course tc ON c.series_id < 0 AND tc.id = ABS(c.series_id)
      WHERE c.certificate_no = ?
    `).get(no) as any;
    if (!row) return Response.json({ success: false, error: '证书不存在' }, { status: 404 });
    return Response.json({
      success: true,
      data: {
        certificateNo: row.certificate_no,
        memberName: row.member_name,
        courseName: row.course_name,
        issueDate: String(row.issue_date || '').slice(0, 10),
        status: row.status || 'active',
        pdfUrl: row.pdf_url || certificatePublicUrl(row.id, row.certificate_no),
      },
    });
  } finally {
    db.close();
  }
}
