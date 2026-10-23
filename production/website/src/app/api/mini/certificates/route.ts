import { getMemberId, jsonError, withDb } from '../_helpers';

function ensureCertificateTables(db: any) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS Certificate (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      certificate_no TEXT NOT NULL UNIQUE,
      series_id INTEGER NOT NULL,
      member_id INTEGER NOT NULL,
      issue_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      pdf_url TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

export async function GET(request: Request) {
  try {
    return withDb((db) => {
      ensureCertificateTables(db);
      const memberId = getMemberId(new URL(request.url).searchParams, request);
      if (!memberId) return jsonError('未登录', 401);

      const rows = db.prepare(`
        SELECT
          c.id,
          c.certificate_no,
          c.series_id,
          c.member_id,
          c.issue_date,
          c.pdf_url,
          c.status,
          c.created_at,
          COALESCE(m.name, '') AS member_name,
          COALESCE(cs.name, '') AS course_name
        FROM Certificate c
        LEFT JOIN Member m ON m.id = c.member_id
        LEFT JOIN CourseSeries cs ON cs.id = c.series_id
        WHERE c.member_id = ?
        ORDER BY datetime(c.issue_date) DESC, c.id DESC
      `).all(memberId);

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
          pdfUrl: row.pdf_url || '',
          pdf_url: row.pdf_url || '',
          status: row.status || 'active',
          created_at: row.created_at,
        })),
      });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
