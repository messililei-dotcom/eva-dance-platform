import type { AdminDb } from '@/lib/server/admin-db';
import fs from 'fs';
import path from 'path';

export type CertificateFieldKey = 'memberName' | 'issueDate' | 'courseName' | 'certificateNo';

export type CertificateFieldConfig = {
  key: CertificateFieldKey;
  label: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  align: 'start' | 'middle' | 'end';
};

export type CertificateTemplate = {
  id?: number;
  series_id: number;
  template_name: string;
  template_image_url: string;
  width: number;
  height: number;
  fields: CertificateFieldConfig[];
  status: string;
  updated_at?: string;
};

export const DEFAULT_CERTIFICATE_FIELDS: CertificateFieldConfig[] = [
  { key: 'memberName', label: '姓名', x: 50, y: 44, fontSize: 44, color: '#2A1D13', align: 'middle' },
  { key: 'courseName', label: '课程', x: 50, y: 56, fontSize: 26, color: '#4B3525', align: 'middle' },
  { key: 'issueDate', label: '日期', x: 67, y: 79, fontSize: 18, color: '#4B3525', align: 'middle' },
  { key: 'certificateNo', label: '编号', x: 50, y: 90, fontSize: 14, color: '#6B5B4A', align: 'middle' },
];

export function ensureCertificateSchema(db: AdminDb) {
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

    CREATE TABLE IF NOT EXISTS CertificateTemplate (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      series_id INTEGER NOT NULL UNIQUE,
      template_name TEXT NOT NULL DEFAULT '默认结业证书',
      template_image_url TEXT DEFAULT '',
      width INTEGER NOT NULL DEFAULT 1200,
      height INTEGER NOT NULL DEFAULT 850,
      fields_json TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  ensureColumn(db, 'Certificate', 'source_platform', "TEXT NOT NULL DEFAULT 'admin'");
  ensureColumn(db, 'Certificate', 'issue_method', "TEXT NOT NULL DEFAULT 'manual'");
  ensureColumn(db, 'Certificate', 'verify_code', 'TEXT DEFAULT ""');
  ensureColumn(db, 'Certificate', 'verify_url', 'TEXT DEFAULT ""');
  ensureColumn(db, 'Certificate', 'completion_rate', 'INTEGER DEFAULT 100');
  ensureColumn(db, 'Certificate', 'template_id', 'INTEGER DEFAULT 0');
  ensureColumn(db, 'Certificate', 'remark', 'TEXT DEFAULT ""');
  ensureColumn(db, 'Certificate', 'updated_at', 'DATETIME DEFAULT ""');
}

function ensureColumn(db: AdminDb, table: string, column: string, definition: string) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!rows.some(row => row.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function offlineCertificateSeriesId(courseId: number | string) {
  return -Math.abs(Number(courseId || 0));
}

export function certificateNo(memberId: number, seriesId: number) {
  const subject = seriesId < 0 ? `T${Math.abs(seriesId)}` : `S${seriesId}`;
  return `EVA-${Date.now()}-${memberId}-${subject}`;
}

export function certificatePublicUrl(id: number | string, no: string) {
  return `/api/certificates/${id}/render.svg?no=${encodeURIComponent(no)}`;
}

export function certificateVerifyUrl(no: string) {
  return `/api/certificates/verify?no=${encodeURIComponent(no)}`;
}

export function parseTemplateFields(value: unknown): CertificateFieldConfig[] {
  if (!value) return DEFAULT_CERTIFICATE_FIELDS;
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!Array.isArray(parsed)) return DEFAULT_CERTIFICATE_FIELDS;
    const byKey = new Map(DEFAULT_CERTIFICATE_FIELDS.map(field => [field.key, field]));
    return parsed
      .filter(item => item && byKey.has(item.key))
      .map(item => {
        const fallback = byKey.get(item.key)!;
        return {
          key: fallback.key,
          label: String(item.label || fallback.label),
          x: clamp(Number(item.x), 0, 100, fallback.x),
          y: clamp(Number(item.y), 0, 100, fallback.y),
          fontSize: clamp(Number(item.fontSize), 10, 96, fallback.fontSize),
          color: /^#[0-9a-f]{6}$/i.test(String(item.color || '')) ? String(item.color) : fallback.color,
          align: ['start', 'middle', 'end'].includes(String(item.align)) ? item.align : fallback.align,
        };
      });
  } catch {
    return DEFAULT_CERTIFICATE_FIELDS;
  }
}

export function normalizeTemplate(row: any, seriesId?: number): CertificateTemplate {
  return {
    id: row?.id,
    series_id: Number(row?.series_id || seriesId || 0),
    template_name: String(row?.template_name || '默认结业证书'),
    template_image_url: String(row?.template_image_url || ''),
    width: Number(row?.width || 1200),
    height: Number(row?.height || 850),
    fields: parseTemplateFields(row?.fields_json),
    status: String(row?.status || 'active'),
    updated_at: row?.updated_at,
  };
}

export function getTemplateForSeries(db: AdminDb, seriesId: number): CertificateTemplate {
  ensureCertificateSchema(db);
  const row = db.prepare('SELECT * FROM CertificateTemplate WHERE series_id = ?').get(seriesId);
  return normalizeTemplate(row, seriesId);
}

export async function ensureTemplateForSeries(db: AdminDb, seriesId: number, courseName = '') {
  ensureCertificateSchema(db);
  const existing = db.prepare('SELECT * FROM CertificateTemplate WHERE series_id = ?').get(seriesId);
  if (existing) return normalizeTemplate(existing, seriesId);

  const generatedImage = await generateCertificateTemplateImage(courseName).catch(() => '');
  const result = db.prepare(`
    INSERT INTO CertificateTemplate (series_id, template_name, template_image_url, width, height, fields_json, status, updated_at)
    VALUES (?, ?, ?, 1200, 850, ?, 'active', datetime('now','localtime'))
  `).run(
    seriesId,
    courseName ? `${courseName}证书模板` : 'AI电子证书模板',
    generatedImage,
    JSON.stringify(DEFAULT_CERTIFICATE_FIELDS),
  );
  return normalizeTemplate({
    id: result.lastInsertRowid,
    series_id: seriesId,
    template_name: courseName ? `${courseName}证书模板` : 'AI电子证书模板',
    template_image_url: generatedImage,
    width: 1200,
    height: 850,
    fields_json: JSON.stringify(DEFAULT_CERTIFICATE_FIELDS),
    status: 'active',
  }, seriesId);
}

export async function generateCertificateTemplateImage(courseName: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return '';

  const model = process.env.OPENAI_CERTIFICATE_IMAGE_MODEL || 'image-2';
  const prompt = [
    'Generate a refined landscape electronic certificate background for a Chinese oriental dance academy.',
    'Leave clean blank areas for recipient name, course name, issue date, and certificate number.',
    'No readable text, no logos, no watermarks. Elegant gold, ivory, and deep burgundy accents.',
    courseName ? `Course theme: ${courseName}.` : '',
  ].filter(Boolean).join(' ');

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      prompt,
      size: '1536x1024',
      n: 1,
      response_format: 'b64_json',
    }),
  });

  if (!response.ok) return '';
  const payload = await response.json().catch(() => ({}));
  const b64 = payload?.data?.[0]?.b64_json;
  if (!b64) return '';

  const dir = path.join(process.cwd(), 'public', 'uploads', 'certificates', 'templates');
  fs.mkdirSync(dir, { recursive: true });
  const filename = `ai-template-${Date.now()}.png`;
  fs.writeFileSync(path.join(dir, filename), Buffer.from(b64, 'base64'));
  return `/uploads/certificates/templates/${filename}`;
}

export function escapeXml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function renderCertificateSvg(record: any, template: CertificateTemplate) {
  const width = template.width || 1200;
  const height = template.height || 850;
  const values: Record<CertificateFieldKey, string> = {
    memberName: String(record.member_name || ''),
    issueDate: String(record.issue_date || '').slice(0, 10),
    courseName: String(record.course_name || '结业证书'),
    certificateNo: String(record.certificate_no || ''),
  };

  const fieldNodes = template.fields.map(field => {
    const x = Math.round(width * field.x / 100);
    const y = Math.round(height * field.y / 100);
    return `<text x="${x}" y="${y}" text-anchor="${field.align}" font-size="${field.fontSize}" fill="${escapeXml(field.color)}" font-weight="${field.key === 'memberName' ? 700 : 500}" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif">${escapeXml(values[field.key])}</text>`;
  }).join('\n');

  const background = template.template_image_url
    ? `<image href="${escapeXml(template.template_image_url)}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" />`
    : `<rect width="100%" height="100%" fill="#FFF9F0"/><rect x="46" y="46" width="${width - 92}" height="${height - 92}" rx="18" fill="none" stroke="#C8A96E" stroke-width="4"/><text x="${width / 2}" y="${height * 0.28}" text-anchor="middle" font-size="58" fill="#8B1A1A" font-weight="700" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif">结业证书</text>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  ${background}
  ${fieldNodes}
</svg>`;
}

function clamp(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}
