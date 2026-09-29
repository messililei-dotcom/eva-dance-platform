import crypto from 'crypto';
import { hasAuth, unauthorized } from '../../../training-db';
import { jsonError, withDb } from '../../_materials';
import { importMissingVodMaterials, syncVodMaterials } from '../../_vod-sync';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function configuredSecret() {
  return String(process.env.VOD_SYNC_SECRET || process.env.ALIYUN_VOD_SYNC_SECRET || '').trim();
}

function readToken(request: Request, search: URLSearchParams) {
  const auth = request.headers.get('authorization') || '';
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1] || '';
  return String(
    request.headers.get('x-vod-sync-secret')
      || request.headers.get('x-webhook-secret')
      || bearer
      || search.get('secret')
      || search.get('token')
      || ''
  ).trim();
}

function constantTimeEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function hasSyncAccess(request: Request, search: URLSearchParams) {
  if (hasAuth(request)) return true;
  const secret = configuredSecret();
  if (!secret) return false;
  return constantTimeEquals(readToken(request, search), secret);
}

function parseLimit(value: unknown, fallback = 100) {
  return Math.max(1, Math.min(5000, Number(value || fallback)));
}

async function runVodSync(input: { limit: number; repairStaleUploads: boolean }) {
  return withDb(async (db) => {
    const vod_import = await importMissingVodMaterials(db, { limit: input.limit });
    const rows = db.prepare(`
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
    `).all(input.limit);
    const vod_sync = await syncVodMaterials(db, rows, {
      limit: input.limit,
      repairStaleUploads: input.repairStaleUploads,
    });

    return Response.json({
      success: true,
      source: 'vod-sync',
      ...vod_sync,
      imported: vod_import.imported,
      claimed: vod_import.claimed || 0,
      repaired: vod_import.repaired || 0,
      import_checked: vod_import.checked,
      import_errors: vod_import.errors,
    });
  });
}

export async function GET(request: Request) {
  const search = new URL(request.url).searchParams;
  if (!hasSyncAccess(request, search)) return unauthorized();
  try {
    return await runVodSync({
      limit: parseLimit(search.get('limit')),
      repairStaleUploads: search.get('repair_stale_uploads') === '1' || search.get('repair_stale_uploads') === 'true',
    });
  } catch (err: any) {
    return jsonError(err?.message || 'VOD 自动同步失败');
  }
}

export async function POST(request: Request) {
  const search = new URL(request.url).searchParams;
  if (!hasSyncAccess(request, search)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  try {
    return await runVodSync({
      limit: parseLimit(body.limit || search.get('limit')),
      repairStaleUploads: body.repair_stale_uploads === true || search.get('repair_stale_uploads') === '1' || search.get('repair_stale_uploads') === 'true',
    });
  } catch (err: any) {
    return jsonError(err?.message || 'VOD 自动同步失败');
  }
}
