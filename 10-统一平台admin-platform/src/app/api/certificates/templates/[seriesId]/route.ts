import { hasAuth, unauthorized } from '../../../training-db';
import { openAdminDb } from '@/lib/server/admin-db';
import {
  DEFAULT_CERTIFICATE_FIELDS,
  ensureCertificateSchema,
  ensureTemplateForSeries,
  normalizeTemplate,
  parseTemplateFields,
} from '@/lib/server/certificates';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ seriesId: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();
  const seriesId = Number(routeParams.seriesId || 0);
  if (!seriesId) return Response.json({ success: false, error: '缺少课程ID' }, { status: 400 });

  const db = openAdminDb();
  try {
    ensureCertificateSchema(db);
    const row = db.prepare('SELECT * FROM CertificateTemplate WHERE series_id = ?').get(seriesId);
    return Response.json({ success: true, data: row ? normalizeTemplate(row, seriesId) : normalizeTemplate({ fields_json: JSON.stringify(DEFAULT_CERTIFICATE_FIELDS) }, seriesId) });
  } finally {
    db.close();
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ seriesId: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();
  const seriesId = Number(routeParams.seriesId || 0);
  if (!seriesId) return Response.json({ success: false, error: '缺少课程ID' }, { status: 400 });
  const body = await request.json().catch(() => ({}));

  const db = openAdminDb();
  try {
    ensureCertificateSchema(db);
    const fieldsJson = JSON.stringify(parseTemplateFields(body.fields));
    db.prepare(`
      INSERT INTO CertificateTemplate (series_id, template_name, template_image_url, width, height, fields_json, status, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'active', datetime('now','localtime'))
      ON CONFLICT(series_id) DO UPDATE SET
        template_name = excluded.template_name,
        template_image_url = excluded.template_image_url,
        width = excluded.width,
        height = excluded.height,
        fields_json = excluded.fields_json,
        status = 'active',
        updated_at = datetime('now','localtime')
    `).run(
      seriesId,
      String(body.template_name || body.templateName || '课程证书模板'),
      String(body.template_image_url || body.templateImageUrl || ''),
      Number(body.width || 1200),
      Number(body.height || 850),
      fieldsJson,
    );
    const row = db.prepare('SELECT * FROM CertificateTemplate WHERE series_id = ?').get(seriesId);
    return Response.json({ success: true, data: normalizeTemplate(row, seriesId) });
  } finally {
    db.close();
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ seriesId: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();
  const seriesId = Number(routeParams.seriesId || 0);
  if (!seriesId) return Response.json({ success: false, error: '缺少课程ID' }, { status: 400 });

  const db = openAdminDb();
  try {
    ensureCertificateSchema(db);
    const course = seriesId < 0
      ? db.prepare('SELECT name FROM Course WHERE id = ?').get(Math.abs(seriesId)) as { name?: string } | undefined
      : db.prepare('SELECT name FROM CourseSeries WHERE id = ?').get(seriesId) as { name?: string } | undefined;
    const template = await ensureTemplateForSeries(db, seriesId, course?.name || '');
    return Response.json({ success: true, data: template });
  } finally {
    db.close();
  }
}
