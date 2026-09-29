import { hasAuth, unauthorized } from '../../../training-db';
import { jsonError, withDb } from '../../_materials';
import { importMissingVodMaterials, syncVodMaterials } from '../../_vod-sync';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const limit = Math.max(1, Math.min(500, Number(body.limit || 100)));
  const repairStaleUploads = body.repair_stale_uploads === true;
  const ids = Array.isArray(body.ids)
    ? body.ids.map((id: unknown) => Number(id)).filter((id: number) => Number.isInteger(id) && id > 0)
    : [];

  try {
    return await withDb(async (db) => {
      const vod_import = await importMissingVodMaterials(db, { limit });
      let rows: any[];
      if (ids.length) {
        const placeholders = ids.map(() => '?').join(',');
        rows = db.prepare(`
          SELECT m.*,
                 CASE WHEN COUNT(cv.id) > 0 THEN 1 ELSE 0 END AS is_referenced
          FROM Material m
          LEFT JOIN CourseVideo cv ON cv.material_id=m.id
          WHERE m.id IN (${placeholders})
          GROUP BY m.id
          ORDER BY m.id DESC
        `).all(...ids);
      } else {
        rows = db.prepare(`
          SELECT m.*,
                 CASE WHEN COUNT(cv.id) > 0 THEN 1 ELSE 0 END AS is_referenced
          FROM Material m
          LEFT JOIN CourseVideo cv ON cv.material_id=m.id
          WHERE m.type='video'
            AND (COALESCE(m.vod_video_id,'') != '' OR m.transcode_status='pending')
          GROUP BY m.id
          ORDER BY
            CASE WHEN m.transcode_status IN ('pending', 'processing') THEN 0 ELSE 1 END,
            m.id DESC
          LIMIT ?
        `).all(limit);
      }

      const vod_sync = await syncVodMaterials(db, rows, { limit, repairStaleUploads });
      return Response.json({
        success: true,
        ...vod_sync,
        imported: vod_import.imported,
        claimed: vod_import.claimed || 0,
        repaired: vod_import.repaired || 0,
        import_checked: vod_import.checked,
        import_errors: vod_import.errors,
      });
    });
  } catch (err: any) {
    return jsonError(err?.message || 'VOD 状态同步失败');
  }
}
