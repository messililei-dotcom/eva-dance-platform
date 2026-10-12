import { getMemberId, jsonError, linkedMemberIds, sqlIn, withDb } from '../../../_helpers';
import { ensureCertificateSchema, getTemplateForSeries } from '@/lib/server/certificates';
import { renderCertificatePng } from '@/lib/server/certificate-preview';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const memberId = getMemberId(new URL(request.url).searchParams, request);
  if (!memberId) return jsonError('未登录', 401);
  const { id } = await params;
  if (!/^\d+$/.test(id)) return jsonError('证书不存在', 404);
  try {
    return await withDb(async db => {
      ensureCertificateSchema(db);
      const linked = sqlIn(linkedMemberIds(db, memberId));
      const record = db.prepare(`
        SELECT c.*, COALESCE(NULLIF(c.recipient_name, ''), m.name, '') AS member_name,
          COALESCE(NULLIF(cs.name, ''), NULLIF(tc.name, ''), '') AS course_name
        FROM Certificate c
        LEFT JOIN Member m ON m.id = c.member_id
        LEFT JOIN CourseSeries cs ON cs.id = c.series_id
        LEFT JOIN Course tc ON c.series_id < 0 AND tc.id = ABS(c.series_id)
        WHERE c.id = ? AND c.status = 'active' AND c.member_id IN (${linked.clause})
      `).get<{ series_id: number }>(Number(id), ...linked.values);
      if (!record) return jsonError('证书不存在或已撤销', 404);
      const png = await renderCertificatePng(record, getTemplateForSeries(db, record.series_id));
      return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store, private' } });
    });
  } catch {
    return jsonError('证书图片暂时无法生成，请检查底图', 422);
  }
}
