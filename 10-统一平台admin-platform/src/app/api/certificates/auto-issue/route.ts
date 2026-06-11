import { openAdminDb } from '@/lib/server/admin-db';
import { hasAuth, unauthorized } from '../../training-db';
import {
  certificateNo,
  certificatePublicUrl,
  certificateVerifyUrl,
  ensureCertificateSchema,
  ensureTemplateForSeries,
} from '@/lib/server/certificates';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!hasAuth(request)) return unauthorized();

  const db = openAdminDb();
  try {
    ensureCertificateSchema(db);

    const seriesVideoCount = db.prepare(`
      SELECT oc.series_id, COALESCE(cs.name, '') AS course_name, COUNT(cv.id) AS video_count
      FROM OnlineCourse oc
      JOIN CourseVideo cv ON cv.course_id = oc.id
      LEFT JOIN CourseSeries cs ON cs.id = oc.series_id
      WHERE oc.status = 'published' AND cv.status = 'published'
      GROUP BY oc.series_id
    `).all() as any[];

    const completedProgress = db.prepare(`
      SELECT vp.member_id, oc.series_id, COUNT(DISTINCT vp.video_id) AS completed_count
      FROM VideoProgress vp
      JOIN CourseVideo cv ON vp.video_id = cv.id
      JOIN OnlineCourse oc ON cv.course_id = oc.id
      WHERE vp.completed = 1
      GROUP BY vp.member_id, oc.series_id
    `).all() as any[];

    let issued = 0;
    for (const series of seriesVideoCount) {
      for (const progress of completedProgress) {
        if (String(progress.series_id) !== String(series.series_id)) continue;
        if (Number(progress.completed_count) < Number(series.video_count)) continue;

        const existing = db.prepare(`
          SELECT id
          FROM Certificate
          WHERE member_id = ? AND series_id = ? AND status = 'active'
        `).get(progress.member_id, series.series_id);

        if (existing) continue;

        const template = await ensureTemplateForSeries(db, Number(series.series_id), series.course_name || '');
        const nextCertificateNo = certificateNo(Number(progress.member_id), Number(series.series_id));
        const result = db.prepare(`
          INSERT INTO Certificate (
            certificate_no, series_id, member_id, issue_date, pdf_url, status,
            source_platform, issue_method, verify_code, verify_url, completion_rate,
            template_id, remark, updated_at
          )
          VALUES (?, ?, ?, datetime('now','localtime'), '', 'active', 'learn', 'auto', ?, ?, 100, ?, '系统检测课程完成后自动颁发', datetime('now','localtime'))
        `).run(
          nextCertificateNo,
          series.series_id,
          progress.member_id,
          nextCertificateNo,
          certificateVerifyUrl(nextCertificateNo),
          template.id || 0,
        );
        db.prepare('UPDATE Certificate SET pdf_url = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?')
          .run(certificatePublicUrl(result.lastInsertRowid, nextCertificateNo), result.lastInsertRowid);
        issued++;
      }
    }

    return Response.json({ success: true, data: { issued } });
  } finally {
    db.close();
  }
}
