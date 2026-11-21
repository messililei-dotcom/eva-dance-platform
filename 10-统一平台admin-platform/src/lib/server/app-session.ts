import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
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
    CREATE TABLE IF NOT EXISTS AppPasswordCredential (
      member_id INTEGER PRIMARY KEY, salt TEXT NOT NULL, digest TEXT NOT NULL,
      expires_at INTEGER NOT NULL, revoked_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS AppPasswordAttempt (key_hash TEXT PRIMARY KEY, attempts INTEGER NOT NULL, window_start INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS AppDeletionRequest (
      id TEXT PRIMARY KEY, member_id INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
      requested_at INTEGER NOT NULL, completed_at INTEGER, note TEXT NOT NULL DEFAULT ''
    );
    CREATE UNIQUE INDEX IF NOT EXISTS app_pending_deletion ON AppDeletionRequest(member_id) WHERE status='pending';
    CREATE TABLE IF NOT EXISTS AppDeletionReceipt (
      token_hash TEXT PRIMARY KEY, request_id TEXT NOT NULL UNIQUE,
      due_at INTEGER NOT NULL, notice TEXT NOT NULL DEFAULT '', acknowledged_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS AppDeletionRetention (
      id TEXT PRIMARY KEY, request_id TEXT NOT NULL, scope TEXT NOT NULL,
      basis TEXT NOT NULL, confirmed_by TEXT NOT NULL, expires_at INTEGER NOT NULL,
      encrypted_data TEXT NOT NULL, created_at INTEGER NOT NULL
    );
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
  if (!/^(1[3-9]\d{9}|\+[1-9]\d{7,14})$/.test(phone) || !/^\d{6}$/.test(code)) throw new AppError('请填写正确的手机号和6位验证码');
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

// Provisioned credentials authenticate the same Member and AppSession as SMS.
// They never grant course rights or create a member from client-supplied identity.
export function setAppPassword(db: AdminDb, memberId: number, password: string, expiresAt: number, now = Date.now()) {
  const member = activeMember(db, memberId);
  if (Number(member.id) !== memberId || password.length < 16 || password.length > 128 || !Number.isSafeInteger(expiresAt) || expiresAt <= now || expiresAt > now + 90 * 86400_000) throw new AppError('账号、密码长度或有效期不正确');
  const salt = randomBytes(16).toString('hex');
  const digest = scryptSync(password, salt, 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString('hex');
  db.transaction(() => {
    db.prepare(`INSERT INTO AppPasswordCredential(member_id,salt,digest,expires_at,revoked_at) VALUES(?,?,?,?,NULL)
      ON CONFLICT(member_id) DO UPDATE SET salt=excluded.salt,digest=excluded.digest,expires_at=excluded.expires_at,revoked_at=NULL`).run(memberId, salt, digest, expiresAt);
    db.prepare('UPDATE AppSession SET revoked_at=? WHERE member_id=? AND revoked_at IS NULL').run(now, memberId);
  })();
}

export function revokeAppPassword(db: AdminDb, memberId: number, now = Date.now()) {
  db.transaction(() => {
    db.prepare('UPDATE AppPasswordCredential SET revoked_at=? WHERE member_id=?').run(now, memberId);
    db.prepare('UPDATE AppSession SET revoked_at=? WHERE member_id=? AND revoked_at IS NULL').run(now, memberId);
  })();
}

export function verifyAppPassword(db: AdminDb, phone: string, password: string, ip: string, now = Date.now()) {
  if (!/^(1[3-9]\d{9}|\+[1-9]\d{7,14})$/.test(phone) || password.length < 1 || password.length > 128) throw new AppError('手机号或密码不正确', 401);
  // Persist throttling before verification, including failed and unknown-account requests.
  db.prepare('DELETE FROM AppPasswordAttempt WHERE window_start<?').run(now - 600000);
  for (const [key, limit] of [[hash('phone:' + phone), 5], [hash('ip:' + ip), 30]] as const) {
    const row = db.prepare('SELECT attempts FROM AppPasswordAttempt WHERE key_hash=?').get<{attempts:number}>(key);
    if (row && row.attempts >= limit) throw new AppError('登录次数较多，请10分钟后重试', 429);
  }
  for (const key of [hash('phone:' + phone), hash('ip:' + ip)]) {
    db.prepare(`INSERT INTO AppPasswordAttempt(key_hash,attempts,window_start) VALUES(?,1,?)
      ON CONFLICT(key_hash) DO UPDATE SET attempts=attempts+1`).run(key, now);
  }
  const domestic = /^1[3-9]\d{9}$/.test(phone);
  const storedPhone = domestic ? `+86${phone}` : phone;
  const members = db.prepare('SELECT id FROM Member WHERE phone IN (?,?,?) LIMIT 2')
    .all<{ id: number }>(phone, storedPhone, storedPhone.slice(1));
  const memberId = members.length === 1 ? Number(members[0].id) : 0;
  const credential = db.prepare('SELECT * FROM AppPasswordCredential WHERE member_id=?').get<{salt:string;digest:string;expires_at:number;revoked_at:number|null}>(memberId);
  const valid = credential && /^[a-f0-9]{32}$/.test(credential.salt) && /^[a-f0-9]{64}$/.test(credential.digest);
  const candidate = scryptSync(password, valid ? credential.salt : '00000000000000000000000000000000', 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  if (!timingSafeEqual(candidate, Buffer.from(valid ? credential.digest : '0'.repeat(64), 'hex')) || !valid || credential.revoked_at !== null || credential.expires_at <= now) throw new AppError('手机号或密码不正确', 401);
  const member = activeMember(db, memberId);
  if (Number(member.id) !== memberId) throw new AppError('手机号或密码不正确', 401);
  // Keep the per-IP counter on success so one valid account cannot clear a burst limit.
  db.prepare('DELETE FROM AppPasswordAttempt WHERE key_hash=?').run(hash('phone:' + phone));
  return memberId;
}
export function requestAccountDeletion(db: AdminDb, memberId: number, now = Date.now(), receiptToken = '') {
  if (receiptToken && !/^eva_d_[A-Za-z0-9_-]{43}$/.test(receiptToken)) throw new AppError('注销回执无效');
  return db.transaction(() => {
    const existing = db.prepare("SELECT id,status,requested_at FROM AppDeletionRequest WHERE member_id=? AND status='pending'").get<{id:string;status:string;requested_at:number}>(memberId);
    const id = existing?.id || randomUUID();
    if (!existing) db.prepare('INSERT INTO AppDeletionRequest(id,member_id,requested_at) VALUES(?,?,?)').run(id, memberId, now);
    // Seven calendar days is an internal deadline stricter than seven working days;
    // holiday/weekend adjustments can never postpone this deadline.
    const dueAt = (existing?.requested_at || now) + 7 * 86400_000;
    if (receiptToken) {
      const receipt = db.prepare('SELECT token_hash FROM AppDeletionReceipt WHERE request_id=?').get<{token_hash:string}>(id);
      if (receipt && receipt.token_hash !== hash(receiptToken)) throw new AppError('注销回执已存在，请使用原回执查询', 409);
      db.prepare('INSERT OR IGNORE INTO AppDeletionReceipt(token_hash,request_id,due_at) VALUES(?,?,?)').run(hash(receiptToken), id, dueAt);
    }
    db.prepare('UPDATE AppSession SET revoked_at=? WHERE member_id=? AND revoked_at IS NULL').run(now, memberId);
    if (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='MemberDeviceSession'").get()) {
      db.prepare("UPDATE MemberDeviceSession SET revoked_at_ms=?,revoke_reason='account_deletion' WHERE member_id=? AND revoked_at_ms=0").run(now, memberId);
    }
    return { id, status: 'pending', requestedAt: existing?.requested_at || now, dueAt, processingWorkingDays: 7 };
  })();
}

export function accountDeletionReceipt(db: AdminDb, token: string, acknowledge = false, now = Date.now()) {
  if (!/^eva_d_[A-Za-z0-9_-]{43}$/.test(token)) throw new AppError('注销回执不存在', 404);
  const row = db.prepare(`SELECT r.id,r.status,r.requested_at,r.completed_at,p.due_at,p.notice,p.acknowledged_at
    FROM AppDeletionReceipt p JOIN AppDeletionRequest r ON r.id=p.request_id WHERE p.token_hash=?`).get<any>(hash(token));
  if (!row) throw new AppError('注销回执不存在', 404);
  if (acknowledge && row.status === 'completed') db.prepare('UPDATE AppDeletionReceipt SET acknowledged_at=COALESCE(acknowledged_at,?) WHERE token_hash=?').run(now, hash(token));
  return { id:row.id, status:row.status, requestedAt:row.requested_at, dueAt:row.due_at, completedAt:row.completed_at,
    overdue:row.status !== 'completed' && now > row.due_at, processingWorkingDays:7,
    notice:row.notice || '已受理，将在7个工作日内完成。请保留本机回执，处理完成后在此查看结果。',
    retention:db.prepare('SELECT id,scope,basis,expires_at AS expiresAt FROM AppDeletionRetention WHERE request_id=? ORDER BY expires_at').all(row.id) };
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
