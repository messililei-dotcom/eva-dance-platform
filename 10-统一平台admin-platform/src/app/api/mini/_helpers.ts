import crypto from 'crypto';
import { openAdminDb, type AdminDb } from '@/lib/server/admin-db';
import { ensureWechatIdentityTables } from '@/lib/server/wechat-identity';
import { isRecord } from '@/lib/data-shape';
import { verifyLocalToken } from '../_local-auth';
import { ensureInboxSchema } from '@/lib/server/inbox';

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

type VisitTracking = {
  platform?: string;
  visitorKey?: string;
  visitorLabel?: string;
  phone?: string;
  wxUnionid?: string;
  pageUrl?: string;
  ipAddress?: string;
  ipRegion?: string;
  referrerMemberId?: number;
  referrerChannel?: string;
  referrerUrl?: string;
  shareCode?: string;
};

function firstHeader(request: Request | undefined, names: string[]) {
  for (const name of names) {
    const value = cleanText(request?.headers.get(name));
    if (value) return value;
  }
  return '';
}

function requestVisitTracking(request?: Request): VisitTracking {
  if (!request) return {};
  const url = new URL(request.url);
  const param = (...names: string[]) => {
    for (const name of names) {
      const value = cleanText(url.searchParams.get(name));
      if (value) return value;
    }
    return '';
  };
  const forwarded = firstHeader(request, ['x-forwarded-for']).split(',')[0]?.trim() || '';
  const region = [
    firstHeader(request, ['x-ip-province', 'cf-region', 'x-vercel-ip-country-region']),
    firstHeader(request, ['x-ip-city', 'cf-ipcity', 'x-vercel-ip-city']),
  ].filter(Boolean).join(' ');
  return {
    platform: firstHeader(request, ['x-client-platform']) || param('platform') || '小程序',
    pageUrl: firstHeader(request, ['x-page-url', 'referer']) || param('page_url') || url.pathname,
    ipAddress: forwarded || firstHeader(request, ['x-real-ip']),
    ipRegion: region || firstHeader(request, ['x-ip-region']),
    referrerMemberId: toPositiveInt(
      firstHeader(request, ['x-referrer-member-id']) || param('ref_member_id', 'share_member_id', 'inviter_id', 'ref'),
      0
    ),
    referrerChannel: firstHeader(request, ['x-referrer-channel']) || param('referrer_channel', 'channel', 'utm_source'),
    referrerUrl: firstHeader(request, ['x-original-referrer']) || param('referrer_url'),
    shareCode: firstHeader(request, ['x-share-code']) || param('share_code'),
  };
}

export function recordSeriesVisit(
  db: AdminDb,
  seriesId: number,
  memberId: number,
  source = 'learn',
  request?: Request,
  tracking: VisitTracking = {}
) {
  if (!seriesId || !memberId) return;
  const context = { ...requestVisitTracking(request) };
  Object.entries(tracking).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      (context as Record<string, unknown>)[key] = value;
    }
  });
  const member = db.prepare(
    "SELECT phone, wx_unionid, name FROM Member WHERE id=?"
  ).get<{ phone?: string; wx_unionid?: string; name?: string }>(memberId);
  db.transaction(() => {
    db.prepare(
      `INSERT INTO CourseSeriesVisitLog (
         member_id, series_id, source, platform, visitor_key, visitor_label, phone, wx_unionid,
         page_url, ip_address, ip_region, referrer_member_id, referrer_channel, referrer_url,
         share_code, visited_at, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULLIF(?, 0), ?, ?, ?, datetime('now','localtime'), datetime('now','localtime'))`
    ).run(
      memberId,
      seriesId,
      source,
      cleanText(context.platform, '小程序'),
      cleanText(context.visitorKey),
      cleanText(context.visitorLabel, member?.name || ''),
      cleanText(context.phone, member?.phone || ''),
      cleanText(context.wxUnionid, member?.wx_unionid || ''),
      cleanText(context.pageUrl),
      cleanText(context.ipAddress),
      cleanText(context.ipRegion),
      toPositiveInt(context.referrerMemberId, 0),
      cleanText(context.referrerChannel),
      cleanText(context.referrerUrl),
      cleanText(context.shareCode)
    );
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
  })();
}

function columns(db: AdminDb, table: string) {
  return db.prepare(`PRAGMA table_info('${table.replace(/'/g, "''")}')`).all<{ name: string }>().map((row) => row.name);
}

function addColumn(db: AdminDb, table: string, column: string, ddl: string) {
  if (!columns(db, table).includes(column)) db.prepare(`ALTER TABLE ${table} ADD COLUMN ${ddl}`).run();
}

export function ensureMiniTables(db: AdminDb) {
  ensureWechatIdentityTables(db);
  ensureInboxSchema(db);
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
  db.prepare(`CREATE TABLE IF NOT EXISTS CourseSeriesVisitLog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL,
    series_id INTEGER NOT NULL,
    source TEXT DEFAULT 'learn',
    visited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).run();
  addColumn(db, 'CourseSeriesVisitLog', 'platform', "platform TEXT DEFAULT ''");
  addColumn(db, 'CourseSeriesVisitLog', 'visitor_key', "visitor_key TEXT DEFAULT ''");
  addColumn(db, 'CourseSeriesVisitLog', 'visitor_label', "visitor_label TEXT DEFAULT ''");
  addColumn(db, 'CourseSeriesVisitLog', 'phone', "phone TEXT DEFAULT ''");
  addColumn(db, 'CourseSeriesVisitLog', 'wx_unionid', "wx_unionid TEXT DEFAULT ''");
  addColumn(db, 'CourseSeriesVisitLog', 'page_url', "page_url TEXT DEFAULT ''");
  addColumn(db, 'CourseSeriesVisitLog', 'ip_address', "ip_address TEXT DEFAULT ''");
  addColumn(db, 'CourseSeriesVisitLog', 'ip_region', "ip_region TEXT DEFAULT ''");
  addColumn(db, 'CourseSeriesVisitLog', 'referrer_member_id', 'referrer_member_id INTEGER');
  addColumn(db, 'CourseSeriesVisitLog', 'referrer_channel', "referrer_channel TEXT DEFAULT ''");
  addColumn(db, 'CourseSeriesVisitLog', 'referrer_url', "referrer_url TEXT DEFAULT ''");
  addColumn(db, 'CourseSeriesVisitLog', 'share_code', "share_code TEXT DEFAULT ''");
  addColumn(db, 'Member', 'avatar', "avatar TEXT DEFAULT ''");
  addColumn(db, 'Member', 'wx_nickname', "wx_nickname TEXT DEFAULT ''");
  addColumn(db, 'Member', 'wx_name', "wx_name TEXT DEFAULT ''");
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
  db.exec("CREATE INDEX IF NOT EXISTS idx_course_series_visit_log_series_member ON CourseSeriesVisitLog(series_id, member_id, visited_at)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_course_series_visit_log_referrer ON CourseSeriesVisitLog(referrer_member_id, visited_at)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_course_series_public ON CourseSeries(status, sort_order, created_at)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_online_course_series_public ON OnlineCourse(series_id, status, sort_order, id)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_course_video_course_public ON CourseVideo(course_id, status, sort_order, id)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_course_auth_series_member ON CourseAuthorization(series_id, member_id, status)");
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
