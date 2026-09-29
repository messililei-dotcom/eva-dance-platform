import { renderCertificatePng } from '@/lib/server/certificate-preview';
import { openAdminDb } from '@/lib/server/admin-db';
import { ensureCertificateSchema, getTemplateForSeries, renderCertificateSvg } from '@/lib/server/certificates';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    if (new URL(request.url).searchParams.get('format') === 'png') {
      try {
        const png = await renderCertificatePng(record, template);
        return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store, private' } });
      } catch {
        return new Response('证书图片暂时无法生成，请检查底图', { status: 422 });
      }
    }
    const svg = renderCertificateSvg(record, template);
    return new Response(svg, {
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'no-store, private',
      },
    });
  } finally {
    db.close();
  }
}
