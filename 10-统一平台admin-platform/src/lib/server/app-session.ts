import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { AdminDb } from './admin-db';

export class AppError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const accessTTL = 15 * 60_000;
const refreshTTL = 30 * 86400_000;
export function ensureAppSchema(db: AdminDb) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS AppSession (
      id TEXT PRIMARY KEY, member_id INTEGER NOT NULL, device_name TEXT NOT NULL,
      access_hash TEXT NOT NULL UNIQUE, refresh_hash TEXT NOT NULL UNIQUE,
      access_until INTEGER NOT NULL, refresh_until INTEGER NOT NULL,
      created_at INTEGER NOT NULL, last_seen INTEGER NOT NULL, revoked_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS AppCarrierAttempt (token_hash TEXT PRIMARY KEY, ip_hash TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS app_carrier_attempt_time ON AppCarrierAttempt(created_at);
    CREATE TABLE IF NOT EXISTS AppSpentRefresh (token_hash TEXT PRIMARY KEY, session_id TEXT NOT NULL, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS AppLoginAttempt (phone_hash TEXT PRIMARY KEY, attempts INTEGER NOT NULL, window_start INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS AppDeletionRequest (
      id TEXT PRIMARY KEY, member_id INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
      requested_at INTEGER NOT NULL, completed_at INTEGER, note TEXT NOT NULL DEFAULT ''
    );
    CREATE UNIQUE INDEX IF NOT EXISTS app_pending_deletion ON AppDeletionRequest(member_id) WHERE status='pending';
    CREATE TABLE IF NOT EXISTS AppLearningCheckpoint (
      member_id INTEGER NOT NULL, lesson_id INTEGER NOT NULL, position REAL NOT NULL, duration REAL NOT NULL,
      revision INTEGER NOT NULL DEFAULT 1, updated_at INTEGER NOT NULL,
      PRIMARY KEY(member_id,lesson_id)
    );
  `);
}
type Row = { id: string; member_id: number; access_until: number; refresh_until: number; revoked_at: number | null };
export function activeMember(db: AdminDb, id: number) {
  const seen = new Set<number>();
  let member: any;
  while (id && !seen.has(id)) {
    seen.add(id);
    member = db.prepare('SELECT * FROM Member WHERE id=?').get<any>(id);
    if (!member) throw new AppError('账号不存在', 401);
    const target = Number(member.merged_to_member_id || 0);
    if (target && target !== id) { id = target; continue; }
    if (member.status && !['active', '正常', 'enabled'].includes(member.status)) throw new AppError('账号暂不可用，请联系平台', 403);
    if (db.prepare("SELECT id FROM AppDeletionRequest WHERE member_id=? AND status='pending'").get(id)) throw new AppError('账号注销申请处理中', 403);
    return member;
  }
  throw new AppError('账号关联异常，请联系平台', 403);
}
function credentials(db: AdminDb, id: string, memberId: number, now: number) {
  const token = `eva_a_${randomBytes(32).toString('base64url')}`;
  const refreshToken = `eva_r_${randomBytes(48).toString('base64url')}`;
  db.prepare('UPDATE AppSession SET access_hash=?,refresh_hash=?,access_until=?,refresh_until=?,last_seen=? WHERE id=?')
    .run(hash(token), hash(refreshToken), now + accessTTL, now + refreshTTL, now, id);
  return { token, refreshToken, expiresAt: now + accessTTL, memberId, sessionId: id };
}
export function createAppSession(db: AdminDb, memberId: number, deviceName: string, now = Date.now()) {
  const member = activeMember(db, memberId);
  const id = randomUUID();
  db.prepare('INSERT INTO AppSession(id,member_id,device_name,access_hash,refresh_hash,access_until,refresh_until,created_at,last_seen) VALUES(?,?,?,?,?,?,?,?,?)')
    .run(id, Number(member.id), deviceName.trim().slice(0, 80) || 'iPhone / iPad', id, id, 0, 0, now, now);
  return credentials(db, id, Number(member.id), now);
}
export function authenticateApp(db: AdminDb, token: string, now = Date.now()) {
  if (!/^eva_a_[A-Za-z0-9_-]{43}$/.test(token)) throw new AppError('请重新登录', 401);
  const session = db.prepare('SELECT * FROM AppSession WHERE access_hash=?').get<Row>(hash(token));
  if (!session || session.revoked_at || session.access_until <= now) throw new AppError('登录已过期，请重新登录', 401);
  const member = activeMember(db, session.member_id);
  if (Number(member.id) !== session.member_id) db.prepare('UPDATE AppSession SET member_id=? WHERE id=?').run(member.id, session.id);
  return { ...session, member_id: Number(member.id), member };
}
export function rotateAppSession(db: AdminDb, token: string, now = Date.now()) {
  if (!/^eva_r_[A-Za-z0-9_-]{64}$/.test(token)) throw new AppError('请重新登录', 401);
  const result = db.transaction(() => {
    db.prepare('DELETE FROM AppSpentRefresh WHERE expires_at<?').run(now);
    const digest = hash(token);
    const spent = db.prepare('SELECT session_id FROM AppSpentRefresh WHERE token_hash=?').get<{session_id: string}>(digest);
    if (spent) {
      // Commit revocation before returning an error; throwing inside the transaction would roll it back.
      db.prepare('UPDATE AppSession SET revoked_at=? WHERE id=?').run(now, spent.session_id);
      return null;
    }
    const session = db.prepare('SELECT * FROM AppSession WHERE refresh_hash=?').get<Row>(digest);
    if (!session || session.revoked_at || session.refresh_until <= now) return null;
    const member = activeMember(db, session.member_id);
    db.prepare('INSERT INTO AppSpentRefresh(token_hash,session_id,expires_at) VALUES(?,?,?)').run(digest, session.id, now + refreshTTL);
    db.prepare('UPDATE AppSession SET member_id=? WHERE id=?').run(member.id, session.id);
    return credentials(db, session.id, Number(member.id), now);
  })();
  if (!result) throw new AppError('登录已失效，请重新验证手机号', 401);
  return result;
}
export function revokeAppSession(db: AdminDb, memberId: number, sessionId: string, now = Date.now()) {
  const result = db.prepare('UPDATE AppSession SET revoked_at=? WHERE id=? AND member_id=? AND revoked_at IS NULL').run(now, sessionId, memberId);
  if (!result.changes) throw new AppError('设备会话不存在', 404);
}
export function verifyAppSMS(db: AdminDb, phone: string, code: string, now = Date.now()) {
  if (!/^1\d{10}$/.test(phone) || !/^\d{6}$/.test(code)) throw new AppError('请填写正确的手机号和6位验证码');
  const key = hash(phone);
  const attempts = db.prepare('SELECT attempts,window_start FROM AppLoginAttempt WHERE phone_hash=?').get<{attempts:number;window_start:number}>(key);
  if (attempts && now - attempts.window_start < 10 * 60_000 && attempts.attempts >= 5) throw new AppError('验证次数较多，请10分钟后重试', 429);
  db.prepare(`INSERT INTO AppLoginAttempt(phone_hash,attempts,window_start) VALUES(?,1,?) ON CONFLICT(phone_hash) DO UPDATE SET
    attempts=CASE WHEN ?-window_start>=600000 THEN 1 ELSE attempts+1 END,
    window_start=CASE WHEN ?-window_start>=600000 THEN ? ELSE window_start END`).run(key, now, now, now, now);
  const record = db.prepare("SELECT id FROM MiniSmsCode WHERE phone=? AND code=? AND used=0 AND expires_at>datetime('now','localtime') ORDER BY id DESC LIMIT 1").get<{id:number}>(phone, code);
  if (!record) throw new AppError('验证码错误或已过期');
  const consumed = db.prepare('UPDATE MiniSmsCode SET used=1 WHERE id=? AND used=0').run(record.id);
  if (consumed.changes !== 1) throw new AppError('验证码已使用');
  db.prepare('DELETE FROM AppLoginAttempt WHERE phone_hash=?').run(key);
}
export function requestAccountDeletion(db: AdminDb, memberId: number, now = Date.now()) {
  return db.transaction(() => {
    const existing = db.prepare("SELECT id,status FROM AppDeletionRequest WHERE member_id=? AND status='pending'").get(memberId);
    const id = randomUUID();
    if (!existing) db.prepare('INSERT INTO AppDeletionRequest(id,member_id,requested_at) VALUES(?,?,?)').run(id, memberId, now);
    db.prepare('UPDATE AppSession SET revoked_at=? WHERE member_id=? AND revoked_at IS NULL').run(now, memberId);
    return existing || { id, status: 'pending' };
  })();
}

export function saveAppCheckpoint(db: AdminDb, memberId: number, lessonId: number, input: {progress:number;duration:number;revision:number}, now = Date.now()) {
  if (!Number.isSafeInteger(lessonId) || lessonId <= 0 || !Number.isSafeInteger(input.revision) || input.revision < 0 || !Number.isFinite(input.progress) || !Number.isFinite(input.duration) || input.duration <= 0 || input.duration > 86400 || input.progress < 0 || input.progress > input.duration) throw new AppError('学习进度无效');
  return db.transaction(() => {
    const previous = db.prepare('SELECT revision FROM AppLearningCheckpoint WHERE member_id=? AND lesson_id=?').get<{revision:number}>(memberId,lessonId);
    if ((previous?.revision || 0) !== input.revision) throw new AppError('该课节已在其他设备更新，请重新加载后继续',409);
    const revision = input.revision + 1;
    db.prepare(`INSERT INTO AppLearningCheckpoint(member_id,lesson_id,position,duration,revision,updated_at) VALUES(?,?,?,?,?,?)
      ON CONFLICT(member_id,lesson_id) DO UPDATE SET position=excluded.position,duration=excluded.duration,revision=excluded.revision,updated_at=excluded.updated_at`)
      .run(memberId,lessonId,input.progress,input.duration,revision,now);
    return {progress:input.progress,duration:input.duration,revision};
  })();
}

// Persist attempts before calling a metered external service, including failures and concurrent replays.
export function reserveCarrierAttempt(db: AdminDb, token: string, ip: string, now = Date.now()) {
  db.transaction(() => {
    db.prepare('DELETE FROM AppCarrierAttempt WHERE created_at<?').run(now - 3600_000);
    if (db.prepare('SELECT 1 FROM AppCarrierAttempt WHERE token_hash=?').get(hash(token))) throw new AppError('请重新获取号码认证凭据', 409);
    const count = db.prepare('SELECT COUNT(*) AS n FROM AppCarrierAttempt WHERE created_at>? AND ip_hash=?').get<any>(now - 60_000, hash(ip));
    const total = db.prepare('SELECT COUNT(*) AS n FROM AppCarrierAttempt WHERE created_at>?').get<any>(now - 60_000);
    if (count.n >= 10 || total.n >= 100) throw new AppError('登录请求过于频繁，请稍后重试', 429);
    db.prepare('INSERT INTO AppCarrierAttempt(token_hash,ip_hash,created_at) VALUES(?,?,?)').run(hash(token), hash(ip), now);
  })();
}
