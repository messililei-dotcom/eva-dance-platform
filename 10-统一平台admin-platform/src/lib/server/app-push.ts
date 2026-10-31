import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import type { AdminDb } from './admin-db';
import { activeMember, AppError, authenticateApp } from './app-session';
import { ensureInboxSchema, unreadInboxCount } from './inbox';

export type PushPlatform = 'ios' | 'android' | 'harmony';
export function pushCapability(platform: string) {
  const platforms = (process.env.APP_PUSH_ACCEPTED_PLATFORMS || '').split(',');
  return { enabled: process.env.APP_PUSH_ENABLED === 'true' && platforms.includes(platform) && !!process.env[`APP_PUSH_${platform.toUpperCase()}_APP_KEY`] && !!process.env.APP_PUSH_TOKEN_KEY,
    provider: 'aliyun', previews: false };
}
function encryptionKey() {
  const raw = process.env.APP_PUSH_TOKEN_KEY || '';
  if (!/^[a-f0-9]{64}$/i.test(raw)) throw new AppError('消息通知配置尚未完成', 503);
  return Buffer.from(raw, 'hex');
}
function seal(value: string) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const body = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64');
}
function unseal(value: string) {
  const data = Buffer.from(value, 'base64'), cipher = createDecipheriv('aes-256-gcm', encryptionKey(), data.subarray(0, 12));
  cipher.setAuthTag(data.subarray(12, 28)); return Buffer.concat([cipher.update(data.subarray(28)), cipher.final()]).toString('utf8');
}
export function ensurePushSchema(db: AdminDb) {
  ensureInboxSchema(db);
  db.exec(`CREATE TABLE IF NOT EXISTS AppPushPermit (installation_id TEXT PRIMARY KEY, session_id TEXT NOT NULL, platform TEXT NOT NULL, created_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS AppPushDevice (
    id TEXT PRIMARY KEY, installation_id TEXT NOT NULL UNIQUE, member_id INTEGER NOT NULL, session_id TEXT NOT NULL,
    platform TEXT NOT NULL, app_key TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, token_cipher TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1, bound_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS app_push_member ON AppPushDevice(member_id, enabled);
  CREATE TABLE IF NOT EXISTS AppPushOutbox (
    id TEXT PRIMARY KEY, recipient_id INTEGER NOT NULL, device_id TEXT NOT NULL,
    member_id INTEGER NOT NULL, session_id TEXT NOT NULL, binding_time INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, provider_id TEXT,
    UNIQUE(recipient_id, device_id)
  );
  CREATE INDEX IF NOT EXISTS app_push_pending ON AppPushOutbox(status, created_at);
  CREATE TRIGGER IF NOT EXISTS app_push_new_recipient AFTER INSERT ON InboxRecipient
  BEGIN
    INSERT OR IGNORE INTO AppPushOutbox(id,recipient_id,device_id,member_id,session_id,binding_time,created_at,updated_at)
    SELECT lower(hex(randomblob(16))),NEW.id,d.id,d.member_id,d.session_id,d.bound_at,
      unixepoch('now')*1000,unixepoch('now')*1000 FROM AppPushDevice d
    JOIN AppSession s ON s.id=d.session_id AND s.member_id=d.member_id
    WHERE d.member_id=NEW.member_id AND d.enabled=1 AND s.revoked_at IS NULL AND s.refresh_until>unixepoch('now')*1000;
  END;`);
}
const installationPattern = /^[a-f0-9]{64}$/;
/** Lifetime ceiling is intentionally lower than the 50,000-device monthly free quota. */
export function reservePushPermit(db: AdminDb, accessToken: string, platform: PushPlatform, installation: string, now = Date.now()) {
  const session = authenticateApp(db, accessToken, now); ensurePushSchema(db);
  if (!pushCapability(platform).enabled) throw new AppError('系统通知配置中', 503);
  if (!installationPattern.test(installation)) throw new AppError('通知设备信息无效');
  return db.transaction(() => {
    const prior = db.prepare('SELECT platform FROM AppPushPermit WHERE installation_id=?').get<any>(installation);
    if (prior && prior.platform !== platform) throw new AppError('通知平台不匹配');
    const count = Number(db.prepare('SELECT COUNT(*) AS count FROM AppPushPermit').get<any>()?.count || 0);
    // No automatic payment, plan upgrade or broad push is performed at the quota boundary.
    const configured = Number(process.env.APP_PUSH_FREE_DEVICE_CAP || 10000);
    const ceiling = Number.isSafeInteger(configured) && configured > 0 ? Math.min(30000, configured) : 1;
    if (!prior && count >= ceiling) throw new AppError('系统通知免费额度已达保护上限，App 内消息不受影响', 503);
    db.prepare('INSERT OR IGNORE INTO AppPushPermit VALUES(?,?,?,?)').run(installation, session.id, platform, now);
    return { allowed: true };
  })();
}
export function bindPushDevice(db: AdminDb, accessToken: string, platform: PushPlatform, body: Record<string, unknown>, now = Date.now()) {
  const session = authenticateApp(db, accessToken, now); ensurePushSchema(db);
  if (!pushCapability(platform).enabled) throw new AppError('系统通知暂未开放，学习消息仍可在 App 内查看', 503);
  if (!installationPattern.test(String(body.installationId || '')) || typeof body.deviceId !== 'string' || !/^[A-Za-z0-9_:-]{16,256}$/.test(body.deviceId)) throw new AppError('通知设备信息无效');
  reservePushPermit(db, accessToken, platform, String(body.installationId), now);
  const installation = String(body.installationId), digest = createHash('sha256').update(body.deviceId).digest('hex');
  const appKey = process.env[`APP_PUSH_${platform.toUpperCase()}_APP_KEY`]!;
  return db.transaction(() => {
    // A vendor device can belong to only one current verified account/session. Never trust memberId in the body.
    const prior = db.prepare('SELECT * FROM AppPushDevice WHERE token_hash=? OR installation_id=? ORDER BY updated_at DESC LIMIT 1').get<any>(digest, installation);
    const boundAt = prior && prior.member_id === session.member_id && prior.session_id === session.id && prior.token_hash === digest && prior.enabled === 1 ? prior.bound_at : now;
    db.prepare('DELETE FROM AppPushDevice WHERE token_hash=? OR installation_id=?').run(digest, installation);
    const id = prior?.id || randomUUID();
    db.prepare('INSERT INTO AppPushDevice VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id, installation, session.member_id, session.id, platform, appKey, digest, seal(String(body.deviceId)), body.enabled === false ? 0 : 1, boundAt, now);
    return { registered: true, enabled: body.enabled !== false };
  })();
}
/** The random installation ID is a revocation-only capability, never an authentication credential. */
export function revokePushInstallation(db: AdminDb, installation: string, sessionId: string, now = Date.now()) {
  if (!installationPattern.test(installation) || !/^[a-f0-9-]{36}$/i.test(sessionId)) throw new AppError('通知设备信息无效');
  ensurePushSchema(db);
  db.prepare('UPDATE AppPushDevice SET enabled=0,updated_at=? WHERE installation_id=? AND session_id=?').run(now,installation,sessionId);
  // Deliberately return the same value for unknown installations.
  return { unbound: true };
}
export function unbindPushDevice(db: AdminDb, accessToken: string, installation: string, now = Date.now()) {
  const session = authenticateApp(db, accessToken, now); ensurePushSchema(db);
  if (!installationPattern.test(installation)) throw new AppError('通知设备信息无效');
  db.prepare('UPDATE AppPushDevice SET enabled=0,updated_at=? WHERE installation_id=? AND member_id=? AND session_id=?').run(now, installation, session.member_id, session.id);
  return { unbound: true };
}
function notExpired(value: unknown, now = Date.now()) {
  if (value === null || value === undefined || value === '') return true;
  const raw = String(value);
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw) ? raw.replace(' ', 'T') + '+08:00' : raw;
  const deadline = Date.parse(normalized);
  return Number.isFinite(deadline) && deadline > now;
}
export function ownedInboxMessage(db: AdminDb, memberId: number, recipientId: number) {
  ensureInboxSchema(db);
  if (!Number.isSafeInteger(recipientId) || recipientId <= 0) throw new AppError('消息不存在', 404);
  const row = db.prepare(`SELECT m.id,m.title,m.content,m.type,m.created_at AS createdAt,m.expires_at,r.id AS recipientId,r.status
    FROM InboxRecipient r JOIN InboxMessage m ON m.id=r.message_id WHERE r.id=? AND r.member_id=? AND r.status<>'archived'
    AND (m.expires_at IS NULL OR m.expires_at>datetime('now','localtime'))`).get<any>(recipientId, memberId);
  if (!row || !notExpired(row.expires_at)) throw new AppError('消息不存在或已失效', 404);
  delete row.expires_at;
  return { ...row, id: String(row.id), recipientId: String(row.recipientId) };
}
export type PushDelivery = { platform: PushPlatform; appKey: string; deviceId: string; badge: number; recipientId: string; deliveryId: string; title: string; body: string; harmonyCategory?: 'WORK'; };
export type PushSender = (value: PushDelivery) => Promise<{ requestId: string }>;
export async function deliverPushOutbox(db: AdminDb, sender: PushSender, limit = 100, now = Date.now()) {
  ensurePushSchema(db);
  // Interrupted HTTP requests have an unknown vendor outcome; do not automatically resend and duplicate alerts.
  db.prepare("UPDATE AppPushOutbox SET status='uncertain',updated_at=? WHERE status='sending' AND updated_at<?").run(now, now-120000);
  const results: Record<string, number> = { sent: 0, skipped: 0, uncertain: 0 };
  for (let n = 0; n < Math.min(100, Math.max(0, limit)); n++) {
    const row = db.transaction(() => {
      const item = db.prepare(`SELECT o.*,d.platform,d.app_key,d.token_cipher,d.enabled,d.member_id AS current_member,d.session_id AS current_session,d.bound_at,
        s.revoked_at,s.refresh_until,r.status AS message_status,m.expires_at,m.type AS message_type,m.business_type
        FROM AppPushOutbox o LEFT JOIN AppPushDevice d ON d.id=o.device_id LEFT JOIN AppSession s ON s.id=d.session_id
        LEFT JOIN InboxRecipient r ON r.id=o.recipient_id LEFT JOIN InboxMessage m ON m.id=r.message_id
        WHERE o.status='pending' ORDER BY o.created_at,o.id LIMIT 1`).get<any>();
      if (!item) return null;
      const changed = db.prepare("UPDATE AppPushOutbox SET status='sending',attempts=attempts+1,updated_at=? WHERE id=? AND status='pending'").run(now,item.id);
      return changed.changes ? item : null;
    })();
    if (!row) break;
    let valid = row.enabled === 1 && row.member_id === row.current_member && row.session_id === row.current_session && row.binding_time === row.bound_at && !row.revoked_at && row.refresh_until > now && row.message_status === 'unread' && pushCapability(row.platform).enabled;
    if (!notExpired(row.expires_at, now)) valid = false;
    // Huawei WORK covers teaching tasks/course reminders. A generic inbox opt-in
    // is not a per-topic subscription: updates, points and announcements stay
    // in the inbox until their own scenario and category have been approved.
    const harmonyWork = row.platform === 'harmony' && row.message_type === 'offline' && row.business_type === 'course_start';
    if (row.platform === 'harmony' && (!harmonyWork || process.env.APP_PUSH_HARMONY_WORK_APPROVED !== 'true')) valid = false;
    try { if (valid && Number(activeMember(db, row.member_id).id) !== row.member_id) valid = false; } catch { valid = false; }
    if (!valid) {
      db.prepare("UPDATE AppPushOutbox SET status='skipped',updated_at=? WHERE id=?").run(now,row.id); results.skipped++; continue;
    }
    try {
      const result = await sender({ platform: row.platform, appKey: row.app_key, deviceId: unseal(row.token_cipher), badge: unreadInboxCount(db,row.member_id), recipientId: String(row.recipient_id), deliveryId: row.id,
        title: harmonyWork ? 'SWOD 课程提醒' : 'SWOD 学习消息',
        body: harmonyWork ? '你有一条课程开课提醒，请打开 App 查看课程安排。' : '你有一条新的学习服务消息，请打开 App 查看。',
        ...(harmonyWork ? { harmonyCategory: 'WORK' as const } : {}) });
      db.prepare("UPDATE AppPushOutbox SET status='sent',provider_id=?,updated_at=? WHERE id=?").run(result.requestId,Date.now(),row.id); results.sent++;
    } catch {
      // Never log tokens, vendor responses or private message content.
      db.prepare("UPDATE AppPushOutbox SET status='uncertain',updated_at=? WHERE id=?").run(Date.now(),row.id); results.uncertain++;
    }
  }
  return results;
}
