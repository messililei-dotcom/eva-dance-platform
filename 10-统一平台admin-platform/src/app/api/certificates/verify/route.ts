import { openAdminDb } from '@/lib/server/admin-db';
import { certificatePublicUrl, ensureCertificateSchema } from '@/lib/server/certificates';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const multiple = params.has('q');
  const query = (params.get(multiple ? 'q' : 'no') || '').trim().normalize('NFC');
  if (!query || query.length > 80) return Response.json({ success: false, error: '请输入证书编号、姓名或手机号码' }, { status: 400 });
  const phone = query.replace(/[\s()+-]/g, '');
  const isPhone = /^\d{7,15}$/.test(phone);
  const normalizePhone = (column: string) => `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(${column}, ''), ' ', ''), '-', ''), '+', ''), '(', ''), ')', '')`;

  const db = openAdminDb();
  try {
    ensureCertificateSchema(db);
    const select = `
      SELECT c.id, c.certificate_no, c.issue_date, c.status, c.pdf_url,
             COALESCE(NULLIF(c.recipient_name, ''), m.name, '') AS member_name,
             COALESCE(NULLIF(cs.name, ''), NULLIF(tc.name, ''), '') AS course_name
      FROM Certificate c
      LEFT JOIN Member m ON m.id = c.member_id
      LEFT JOIN CourseSeries cs ON cs.id = c.series_id
      LEFT JOIN Course tc ON c.series_id < 0 AND tc.id = ABS(c.series_id)
      WHERE ${multiple ? `c.certificate_no = @query OR COALESCE(NULLIF(c.recipient_name, ''), m.name, '') = @query OR (@isPhone = 1 AND (${normalizePhone('m.phone')} = @phone OR ${normalizePhone('m.phone_national_number')} = @phone OR (${normalizePhone('m.phone_country_code')} || ${normalizePhone('m.phone_national_number')}) = @phone))` : 'c.certificate_no = @query'}
      ORDER BY c.issue_date DESC, c.id DESC
    `;
    const rows = db.prepare(select).all(multiple ? { query, phone, isPhone: isPhone ? 1 : 0 } : { query }) as any[];
    if (!rows.length) return Response.json({ success: false, error: '证书不存在' }, { status: 404 });
    return Response.json({
      success: true,
      data: multiple ? rows.map(toData) : toData(rows[0]),
    }, { headers: { 'Cache-Control': 'no-store' } });
    function toData(row: any) { return {
        certificateNo: row.certificate_no,
        memberName: row.member_name,
        courseName: row.course_name,
        issueDate: String(row.issue_date || '').slice(0, 10),
        status: row.status || 'active',
        pdfUrl: row.pdf_url || certificatePublicUrl(row.id, row.certificate_no),
      }; }
  } finally {
    db.close();
  }
}
