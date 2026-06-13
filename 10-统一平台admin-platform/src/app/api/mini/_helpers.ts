import crypto from 'crypto';
import { openAdminDb, type AdminDb } from '@/lib/server/admin-db';
import { isRecord } from '@/lib/data-shape';
import { verifyLocalToken } from '../_local-auth';

const MEMBER_SESSION_TTL_MS = 3 * 86400 * 1000;

export function jsonError(message: string, status = 500) {
  const safeMessage = sanitizeErrorMessage(message, status);
  return Response.json({ success: false, message: safeMessage, error: safeMessage }, { status });
}

function sanitizeErrorMessage(message: unknown, status = 500) {
  const text = String(message || '').trim();
  if (!text) return '操作失败';
  if (process.env.NODE_ENV !== 'production') return text;
  if (status >= 500 || isSensitiveErrorMessage(text)) return '操作失败，请稍后再试';
  return text;
}

function isSensitiveErrorMessage(message: string) {
  return [
    /\bInternal\b/i,
    /\bError\b/,
    /\b(SQLITE|SQL|database|better-sqlite3)\b/i,
    /\b(ENOENT|EACCES|EPERM|EISDIR|ENOTDIR)\b/,
    /\/(?:Users|private|var|tmp|app|workspace)\//,
    /[A-Za-z]:\\/,
    /\bat\s+\S+\s+\(/,
  ].some(pattern => pattern.test(message));
}

export function withDb<T>(fn: (db: AdminDb) => T): T {
  const db = openAdminDb();
  try {
    ensureMiniTables(db);
    const result = fn(db);
    if (isRecord(result) && typeof result.then === 'function') {
      return (result as unknown as Promise<void>).finally(() => db.close()) as unknown as T;
    }
    db.close();
    return result;
  } catch (err) {
    db.close();
    throw err;
  }
}

export function cleanText(value: unknown, fallback = '') {
  const text = String(value ?? '').normalize('NFC').trim();
  return text || fallback;
}

export function toPositiveInt(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

function verifyMemberToken(token: string) {
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return 0;
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error('ADMIN_SESSION_SECRET 环境变量未配置');
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const sigBuffer = Buffer.from(sig);
  const expectedBuffer = Buffer.from(expected);
  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) return 0;
  try {
    const body = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
    if (toPositiveInt(body.exp, 0) && Number(body.exp) < Date.now()) return 0;
    return toPositiveInt(body.memberId ?? body.member_id ?? body.id, 0);
  } catch {
    return 0;
  }
}

function bearerToken(request?: Request) {
  return request?.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || '';
}

export function isLocalAdminRequest(request?: Request) {
  const token = bearerToken(request);
  if (!token?.startsWith('local.')) return false;
  try {
    return !!verifyLocalToken(token);
  } catch {
    return false;
  }
}

export function getMemberId(params: URLSearchParams, request?: Request) {
  const token = bearerToken(request);
  return token ? verifyMemberToken(token) : 0;
}

export function recordSeriesVisit(db: AdminDb, seriesId: number, memberId: number, source = 'learn') {
  if (!seriesId || !memberId) return;
  db.prepare(
    `INSERT INTO CourseSeriesVisit (member_id, series_id, source, first_visited_at, last_visited_at, visit_count)
     VALUES (?, ?, ?, datetime('now','localtime'), datetime('now','localtime'), 1)
     ON CONFLICT(member_id, series_id) DO UPDATE SET
       last_visited_at=excluded.last_visited_at,
       source=CASE
         WHEN excluded.source='auth_request' THEN excluded.source
         WHEN COALESCE(CourseSeriesVisit.source, '')='' THEN excluded.source
         ELSE CourseSeriesVisit.source
       END,
       visit_count=CourseSeriesVisit.visit_count + 1`
  ).run(memberId, seriesId, source);
}

function columns(db: AdminDb, table: string) {
  return db.prepare(`PRAGMA table_info('${table.replace(/'/g, "''")}')`).all<{ name: string }>().map((row) => row.name);
}

function addColumn(db: AdminDb, table: string, column: string, ddl: string) {
  if (!columns(db, table).includes(column)) db.prepare(`ALTER TABLE ${table} ADD COLUMN ${ddl}`).run();
}

export function ensureMiniTables(db: AdminDb) {
  db.prepare(`CREATE TABLE IF NOT EXISTS StudyNote (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL,
    video_id INTEGER NOT NULL,
    timestamp_seconds INTEGER NOT NULL DEFAULT 0,
    content TEXT NOT NULL DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS VideoBookmark (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL,
    video_id INTEGER NOT NULL,
    timestamp_seconds INTEGER NOT NULL DEFAULT 0,
    label TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS Question (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL,
    series_id INTEGER NOT NULL,
    course_id INTEGER DEFAULT 0,
    content TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS Answer (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id INTEGER NOT NULL,
    member_id INTEGER NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    is_teacher INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS PracticeCheckin (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL,
    checkin_date TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    submission_type TEXT DEFAULT 'text',
    submission_url TEXT DEFAULT '',
    remark TEXT DEFAULT ''
  )`).run();
  addColumn(db, 'PracticeCheckin', 'series_id', 'series_id INTEGER DEFAULT 0');
  db.prepare(`CREATE TABLE IF NOT EXISTS MiniSmsCode (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    used INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS CourseSeriesVisit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL,
    series_id INTEGER NOT NULL,
    source TEXT DEFAULT 'learn',
    first_visited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_visited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    visit_count INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(member_id, series_id)
  )`).run();
  addColumn(db, 'Member', 'wx_nickname', "wx_nickname TEXT DEFAULT ''");
  addColumn(db, 'Member', 'wx_avatar_url', "wx_avatar_url TEXT DEFAULT ''");
  addColumn(db, 'Member', 'wx_openid', "wx_openid TEXT DEFAULT ''");
  addColumn(db, 'Member', 'wx_unionid', "wx_unionid TEXT DEFAULT ''");
  addColumn(db, 'Member', 'wx_session_key', "wx_session_key TEXT DEFAULT ''");
  addColumn(db, 'Member', 'wx_session_updated_at', 'wx_session_updated_at DATETIME DEFAULT NULL');
  addColumn(db, 'Member', 'wx_profile_synced_at', 'wx_profile_synced_at DATETIME DEFAULT NULL');

  // 性能索引
  db.exec("CREATE INDEX IF NOT EXISTS idx_study_note_member ON StudyNote(member_id, video_id, created_at)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_video_bookmark_member ON VideoBookmark(member_id, video_id, created_at)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_practice_checkin_member ON PracticeCheckin(member_id, checkin_date)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_mini_sms_code_phone ON MiniSmsCode(phone, used, expires_at)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_question_series ON Question(series_id, created_at)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_answer_question ON Answer(question_id, created_at)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_course_series_visit_series ON CourseSeriesVisit(series_id, first_visited_at)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_course_series_visit_member ON CourseSeriesVisit(member_id, last_visited_at)");
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_member_wx_openid ON Member(wx_openid) WHERE wx_openid <> ''");
  db.exec("CREATE INDEX IF NOT EXISTS idx_member_wx_unionid ON Member(wx_unionid) WHERE wx_unionid <> ''");
}

export function isMiniAdmin(db: AdminDb, memberId: unknown) {
  const id = toPositiveInt(memberId, 0);
  if (!id) return false;
  const phone = db.prepare('SELECT phone FROM Member WHERE id=?').get<{ phone?: string }>(id)?.phone;
  return !!(phone && db.prepare("SELECT id FROM AdminUser WHERE phone=? AND status='active'").get(phone));
}

export function canManageMini(db: AdminDb, request: Request) {
  const token = bearerToken(request);
  if (token?.startsWith('local.')) return isLocalAdminRequest(request);
  const memberId = getMemberId(new URL(request.url).searchParams, request);
  return isMiniAdmin(db, memberId);
}

export function shanghaiDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function memberToken(member: { id: unknown; phone?: unknown }) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error('ADMIN_SESSION_SECRET 环境变量未配置');
  const memberId = toPositiveInt(member.id, 0);
  const now = Date.now();
  const payload = Buffer.from(JSON.stringify({
    id: memberId,
    memberId,
    phone: member.phone || '',
    iat: now,
    exp: now + MEMBER_SESSION_TTL_MS,
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}
