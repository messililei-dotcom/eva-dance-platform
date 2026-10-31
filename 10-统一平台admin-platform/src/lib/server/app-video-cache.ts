import { createHash } from 'node:crypto';
import type { AdminDb } from './admin-db';
import { AppError, authenticateApp } from './app-session';
import { getActiveAuthorization, getVideoAccessStatus } from '../../app/api/course/series/[id]/_authorization';
import { getVodDownloadPlayAuth, isVodConfigured } from './aliyun-vod';

export const OFFLINE_LEASE_MS = 24 * 60 * 60_000;
export type CachePlatform = 'ios' | 'android' | 'harmony';
/** Explicit release gates: never infer encrypted download from an online signed URL. */
export function videoCacheCapability(platform: CachePlatform) {
  const ready = process.env.APP_VOD_CACHE_ENABLED === 'true'
    && process.env.APP_VOD_DOWNLOAD_MODE === 'secure'
    && process.env.APP_VOD_CACHE_ACCEPTED_PLATFORMS?.split(',').includes(platform)
    && isVodConfigured();
  return { enabled: Boolean(ready), mode: 'aliyun-secure', renewalHours: 24, maxConcurrent: 1, maxBytes: 1024 * 1024 * 1024,
    message: ready ? '加密缓存仅限本账号在本设备学习，每 24 小时需联网续期' : '课程安全缓存尚未开放，请先在线观看' };
}
export function authorizationDeadline(expiry: unknown, now: number): number {
  if (expiry === null || expiry === undefined) return now + OFFLINE_LEASE_MS;
  // SQLite course dates use China local time. Never interpret them in the host timezone.
  const text = String(expiry).trim();
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text)) throw new AppError('课程有效期暂无法确认，请重试', 409);
  const end = Date.parse(text.replace(' ', 'T') + '+08:00');
  if (!Number.isFinite(end) || end <= now) throw new AppError('学习权益已到期', 403);
  return Math.min(end, now + OFFLINE_LEASE_MS);
}
function cacheVideo(db: AdminDb, session: ReturnType<typeof authenticateApp>, lessonId: number) {
  const row = db.prepare(`SELECT cv.id,cv.material_id,cv.name,oc.series_id,cs.status AS series_status,m.vod_video_id,m.updated_at,m.type
    FROM CourseVideo cv JOIN OnlineCourse oc ON oc.id=cv.course_id JOIN CourseSeries cs ON cs.id=oc.series_id
    JOIN Material m ON m.id=cv.material_id WHERE cv.id=?`).get(lessonId) as
    { id: number; material_id: number; name: string; series_id: number; series_status: string; vod_video_id: string; updated_at: string; type: string } | undefined;
  if (!row || row.series_status !== 'published') throw new AppError('课节暂不可缓存', 404);
  const access = getVideoAccessStatus(db, lessonId, session.member_id, session.member.phone || '');
  if (!access.authorized) throw new AppError('当前课节没有有效学习权限', 403);
  // A free preview is not a paid learning entitlement. Never grant a paid-course offline lease for it.
  const auth = getActiveAuthorization(db, row.series_id, session.member_id, session.member.phone || '');
  if (!auth) throw new AppError('安全缓存仅向拥有课程学习权益的学员开放', 403);
  if (!/^[a-fA-F0-9]{32}$/.test(String(row.vod_video_id || '')) || row.type === 'audio') throw new AppError('本课节暂不支持安全缓存，请在线观看', 409);
  const version = createHash('sha256').update([row.id,row.series_id,row.material_id,row.vod_video_id,row.updated_at].join(':')).digest('hex');
  return {row, auth, version};
}
export async function authorizeVideoCache(db: AdminDb, token: string, platform: CachePlatform, lessonId: number,
  body: { action?: unknown; device_id?: unknown; material_version?: unknown },
  obtainAuth = getVodDownloadPlayAuth, clock = Date.now) {
  const now = clock();
  if (!Number.isSafeInteger(lessonId) || lessonId <= 0) throw new AppError('课节无效');
  if (!['download','renew'].includes(String(body.action))) throw new AppError('缓存操作无效');
  if (typeof body.device_id !== 'string' || !/^[a-f0-9]{64}$/.test(body.device_id)) throw new AppError('缓存设备标识无效');
  const session = authenticateApp(db, token, now);
  const capability = videoCacheCapability(platform);
  if (!capability.enabled) throw new AppError(capability.message, 503);
  const {row, auth, version} = cacheVideo(db, session, lessonId);
  const expiry = Math.min(authorizationDeadline(auth.expire_at, now), session.refresh_until);
  if (expiry <= now) throw new AppError('请重新登录后缓存课程', 401);
  if (body.action === 'renew' && body.material_version !== version) throw new AppError('课程内容已更新，请删除旧缓存后重新缓存', 409);
  db.exec(`CREATE TABLE IF NOT EXISTS AppVideoCacheDevice (
    session_id TEXT PRIMARY KEY, member_id INTEGER NOT NULL, platform TEXT NOT NULL, device_id TEXT NOT NULL,
    window_start INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0
  )`);
  // Durable per-session binding and rate limit. Caller cannot choose a different account/session.
  const bound = db.prepare('SELECT * FROM AppVideoCacheDevice WHERE session_id=?').get(session.id) as
    {device_id: string; member_id: number; platform: string; window_start: number; attempts: number} | undefined;
  if (bound && (bound.device_id !== body.device_id || bound.platform !== platform || bound.member_id !== session.member_id)) throw new AppError('缓存设备不匹配，请重新登录', 403);
  const sameWindow = Boolean(bound && now - bound.window_start < 60_000);
  if (sameWindow && bound!.attempts >= 20) throw new AppError('缓存请求频繁，请稍后重试', 429);
  db.prepare(`INSERT INTO AppVideoCacheDevice VALUES(?,?,?,?,?,1) ON CONFLICT(session_id) DO UPDATE SET
    window_start=excluded.window_start,attempts=?`).run(session.id,session.member_id,platform,body.device_id,
      sameWindow ? bound!.window_start : now,sameWindow ? bound!.attempts + 1 : 1);
  // PlayAuth is short lived and never shared or persisted. Renewing an existing file issues no download credential.
  const credentialTTL = Math.min(300, Math.floor((expiry - now) / 1000));
  if (body.action === 'download' && credentialTTL < 100) throw new AppError('课程即将到期，请在线观看', 409);
  const credential = body.action === 'download' ? await obtainAuth(row.vod_video_id, credentialTTL) : null;
  // A refund, session revocation, merge or rebind during the cloud RPC must still prevent delivery.
  const deliveryTime = clock();
  if (deliveryTime < now || !Number.isFinite(deliveryTime)) throw new AppError('服务时间异常，请稍后重试', 503);
  const current = authenticateApp(db, token, deliveryTime);
  const fresh = cacheVideo(db, current, lessonId);
  if (current.id !== session.id || current.member_id !== session.member_id || fresh.version !== version) throw new AppError('学习状态已变化，请重试', 409);
  const deliveredExpiry = Math.min(expiry,authorizationDeadline(fresh.auth.expire_at,deliveryTime),current.refresh_until);
  if (deliveredExpiry <= deliveryTime) throw new AppError('学习权益已到期', 403);
  return { version: 1, mode: 'aliyun-secure', member_id: session.member_id, session_id: session.id, device_id: body.device_id,
    lesson_id: row.id, series_id: row.series_id, vod_video_id: row.vod_video_id, material_version: version,
    issued_at: deliveryTime, expires_at: deliveredExpiry, max_bytes: capability.maxBytes, credential };
}
