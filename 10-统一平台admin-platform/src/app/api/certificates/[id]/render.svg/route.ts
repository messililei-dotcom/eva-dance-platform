import { openAdminDb } from '@/lib/server/admin-db';
import { ensureCertificateSchema, getTemplateForSeries, renderCertificateSvg } from '@/lib/server/certificates';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  const db = openAdminDb();
  try {
    ensureCertificateSchema(db);
    const record = db.prepare(`
      SELECT c.*, COALESCE(m.name, '') AS member_name,
             COALESCE(NULLIF(cs.name, ''), NULLIF(tc.name, ''), '') AS course_name
      FROM Certificate c
      LEFT JOIN Member m ON m.id = c.member_id
      LEFT JOIN CourseSeries cs ON cs.id = c.series_id
      LEFT JOIN Course tc ON c.series_id < 0 AND tc.id = ABS(c.series_id)
      WHERE c.id = ? AND c.status = 'active'
    `).get(Number(routeParams.id));
    if (!record) return new Response('证书不存在或已撤销', { status: 404 });

    const template = getTemplateForSeries(db, Number((record as any).series_id));
    return new Response(renderCertificateSvg(record, template), {
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'no-store, private',
      },
    });
  } finally {
    db.close();
  }
}
