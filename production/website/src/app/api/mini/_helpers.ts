import crypto from 'crypto';
import { openAdminDb, type AdminDb } from '@/lib/server/admin-db';
import { isRecord } from '@/lib/data-shape';
import { ensureWechatIdentityTables } from '@/lib/server/wechat-identity';

const MEMBER_SESSION_TTL_MS = 3 * 86400 * 1000;
const MEMBER_SESSION_ABSOLUTE_TTL_MS = 30 * 86400 * 1000;
const MEMBER_SESSION_COOKIE = '__Host-eva_session';
const MEMBER_DEVICE_COOKIE = '__Host-eva_device';

type MemberTokenPayload = {
  id: number;
  memberId: number;
  phone?: string;
  sid?: string;
  iat: number;
  exp: number;
};

export type MemberDeviceSession = {
  id: string;
  memberId: number;
  token: string;
  deviceSecret: string;
  expiresAt: number;
};

export function jsonError(message: string, status = 500) {
  return Response.json({ success: false, message }, { status });
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

export function normalizePhoneNumber(value: unknown, countryCode: unknown = '+86') {
  const raw = cleanText(value);
  const country = cleanText(countryCode, '+86').replace(/[^\d+]/g, '');
  if (!raw) return '';
  if (raw.trim().startsWith('+')) {
    const digits = raw.replace(/[^\d]/g, '');
    if (digits.startsWith('86') && digits.length === 13) return digits.slice(2);
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : '';
  }
  const local = raw.replace(/[^\d]/g, '');
  const dialCode = country.startsWith('+') ? country : `+${country || '86'}`;
  if (dialCode === '+86') return /^1\d{10}$/.test(local) ? local : '';
  return local.length >= 5 && local.length <= 14 ? `${dialCode}${local}` : '';
}

export function normalizeInternationalPhone(phoneValue: unknown, countryCodeValue: unknown = '+86') {
  const rawPhone = cleanText(phoneValue).replace(/[()\-\s]/g, '');
  const rawCountryCode = cleanText(countryCodeValue, '+86').replace(/[^\d+]/g, '');
  const countryCode = rawCountryCode.startsWith('+') ? rawCountryCode : `+${rawCountryCode || '86'}`;
  const countryDigits = countryCode.replace(/\D/g, '');
  const phoneDigits = rawPhone.replace(/\D/g, '');

  if (!countryDigits || countryDigits.length > 4) throw new Error('请选择正确的国家区号');
  if (!phoneDigits) throw new Error('请输入手机号');

  let nationalNumber = phoneDigits;
  if (rawPhone.startsWith('+')) {
    if (!phoneDigits.startsWith(countryDigits)) throw new Error('手机号与所选国家区号不一致');
    nationalNumber = phoneDigits.slice(countryDigits.length);
  }

  if (countryDigits === '86') {
    if (!/^1[3-9]\d{9}$/.test(nationalNumber)) throw new Error('请输入正确的中国大陆手机号');
  } else if (nationalNumber.length < 4 || nationalNumber.length > 14) {
    throw new Error('请输入正确的国际手机号');
  }

  const phone = countryDigits === '86' ? nationalNumber : `+${countryDigits}${nationalNumber}`;
  return {
    phone,
    countryCode: `+${countryDigits}`,
    nationalNumber,
  };
}

export function phoneForSmsGateway(phone: string) {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) return '';
  return normalized.startsWith('+') ? normalized.slice(1) : normalized;
}

export function toPositiveInt(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

function readCookie(request: Request | undefined, name: string) {
  const cookie = request?.headers.get('cookie') || '';
  for (const part of cookie.split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return '';
}

function parseMemberToken(token: string): MemberTokenPayload | null {
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const secret = process.env.ADMIN_SESSION_SECRET || 'mini-student-token';
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const sigBuffer = Buffer.from(sig);
  const expectedBuffer = Buffer.from(expected);
  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) return null;
  try {
    const body = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
    const id = toPositiveInt(body.id || body.memberId, 0);
    const exp = Number(body.exp || 0);
    if (!id || !Number.isFinite(exp) || exp <= Date.now()) return null;
    return {
      id,
      memberId: id,
      phone: cleanText(body.phone),
      sid: cleanText(body.sid),
      iat: Number(body.iat || 0),
      exp,
    };
  } catch {
    return null;
  }
}

function parseUnverifiedDeviceToken(token: string) {
  const [payload] = token.split('.');
  if (!payload) return null;
  try {
    const body = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
    const id = toPositiveInt(body.id || body.memberId, 0);
    const sid = cleanText(body.sid);
    const exp = Number(body.exp || 0);
    return id && sid && Number.isFinite(exp) && exp > Date.now() ? { id, sid } : null;
  } catch {
    return null;
  }
}

function deviceHashWithKey(deviceSecret: string, secret: string) {
  return crypto.createHmac('sha256', secret).update(deviceSecret).digest('hex');
}

function deviceHash(deviceSecret: string) {
  return deviceHashWithKey(deviceSecret, process.env.ADMIN_SESSION_SECRET || 'mini-student-token');
}

function matchesDeviceHash(deviceSecret: string, storedHash: string) {
  const candidates = new Set([
    deviceHash(deviceSecret),
    // Sessions created before the unified secret was loaded used this legacy
    // key. It is accepted only alongside the random HttpOnly device secret and
    // an active database session, then upgraded immediately.
    deviceHashWithKey(deviceSecret, 'mini-student-token'),
  ]);
  const expected = Buffer.from(storedHash);
  return [...candidates].some(candidate => {
    const actual = Buffer.from(candidate);
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  });
}

function sessionToken(member: { id: unknown; phone?: unknown }, sessionId = '') {
  const secret = process.env.ADMIN_SESSION_SECRET || 'mini-student-token';
  const memberId = toPositiveInt(member.id, 0);
  const now = Date.now();
  const payload = Buffer.from(JSON.stringify({
    id: memberId,
    memberId,
    phone: member.phone || '',
    ...(sessionId ? { sid: sessionId } : {}),
    iat: now,
    exp: now + MEMBER_SESSION_TTL_MS,
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyMemberToken(token: string, request?: Request) {
  const payload = parseMemberToken(token);
  if (!payload) return 0;
  // Legacy signed tokens remain valid during the three-day migration window.
  if (!payload.sid) return payload.id;

  const deviceSecret = readCookie(request, MEMBER_DEVICE_COOKIE);
  if (!deviceSecret) return 0;
  const db = openAdminDb();
  try {
    const session = db.prepare(
      `SELECT member_id, device_hash
       FROM MemberDeviceSession
       WHERE id=? AND revoked_at_ms=0 AND expires_at_ms>? AND absolute_expires_at_ms>?
       LIMIT 1`
    ).get<{ member_id?: number; device_hash?: string }>(payload.sid, Date.now(), Date.now());
    if (!session || Number(session.member_id) !== payload.id) return 0;
    const actualHash = Buffer.from(deviceHash(deviceSecret));
    const expectedHash = Buffer.from(String(session.device_hash || ''));
    if (actualHash.length !== expectedHash.length || !crypto.timingSafeEqual(actualHash, expectedHash)) return 0;
    return payload.id;
  } catch {
    return 0;
  } finally {
    db.close();
  }
}

export function getMemberId(_params: URLSearchParams, request?: Request) {
  // 个人数据只能由已验证的登录令牌确定。查询参数中的 member_id 仅是旧版
  // 客户端提示值，绝不能覆盖或替代当前登录身份。
  return getAuthenticatedMemberId(request);
}

export function getMemberToken(request?: Request, params?: URLSearchParams) {
  return request?.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
    || readCookie(request, MEMBER_SESSION_COOKIE)
    || params?.get('token')?.trim()
    || '';
}

export function getAuthenticatedMemberIdentity(request: Request) {
  const candidates = [request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim(), readCookie(request, MEMBER_SESSION_COOKIE)].filter(Boolean) as string[];
  for (const token of candidates) {
    if (verifyMemberToken(token, request)) return parseMemberToken(token);
  }
  return null;
}

export function getAuthenticatedMemberId(request?: Request, params?: URLSearchParams) {
  const candidates = [
    request?.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim(),
    readCookie(request, MEMBER_SESSION_COOKIE),
    params?.get('token')?.trim(),
  ].filter(Boolean) as string[];
  for (const token of candidates) {
    const memberId = verifyMemberToken(token, request);
    if (memberId) return memberId;
  }
  return 0;
}

// Used only by the refresh endpoint during signing-key rotation. The old token
// signature is not trusted: recovery succeeds solely when its session id,
// member id and the browser's 256-bit device secret match an active database
// session. The endpoint then immediately issues a token signed by the new key.
export function getRecoverableDeviceSessionMemberId(db: AdminDb, request: Request) {
  const deviceSecret = readCookie(request, MEMBER_DEVICE_COOKIE);
  if (!deviceSecret) return 0;
  const candidates = [
    request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim(),
    readCookie(request, MEMBER_SESSION_COOKIE),
  ].filter(Boolean) as string[];
  for (const token of candidates) {
    const payload = parseUnverifiedDeviceToken(token);
    if (!payload) continue;
    const session = db.prepare(
      `SELECT member_id, device_hash
       FROM MemberDeviceSession
       WHERE id=? AND member_id=? AND revoked_at_ms=0
         AND expires_at_ms>? AND absolute_expires_at_ms>?
       LIMIT 1`
    ).get<{ member_id?: number; device_hash?: string }>(payload.sid, payload.id, Date.now(), Date.now());
    if (!session) continue;
    const storedHash = String(session.device_hash || '');
    if (matchesDeviceHash(deviceSecret, storedHash)) {
      const currentHash = deviceHash(deviceSecret);
      if (storedHash !== currentHash) {
        db.prepare('UPDATE MemberDeviceSession SET device_hash=? WHERE id=?').run(currentHash, payload.sid);
      }
      return payload.id;
    }
  }
  return 0;
}

export function getMemberForDataSync(db: AdminDb, memberId: unknown) {
  const id = toPositiveInt(memberId, 0);
  if (!id) return null;
  return db.prepare('SELECT id, name, phone FROM Member WHERE id=?').get<{
    id: number;
    name?: string;
    phone?: string;
  }>(id) || null;
}

function visitorIdentity(request?: Request) {
  const explicit = request?.headers.get('x-visitor-id') || request?.headers.get('x-openid') || '';
  const forwardedFor = request?.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '';
  const realIp = request?.headers.get('x-real-ip') || '';
  const userAgent = request?.headers.get('user-agent') || '';
  const raw = cleanText(explicit || `${forwardedFor || realIp || 'unknown'}|${userAgent}`, 'anonymous');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  const syntheticId = -(parseInt(hash.slice(0, 8), 16) || 1);
  return {
    memberId: syntheticId,
    key: hash.slice(0, 24),
    label: `游客 ${hash.slice(0, 6)}`,
  };
}

export function visitPlatform(request?: Request) {
  const explicit = cleanText(
    request?.headers.get('x-platform')
      || request?.headers.get('x-client-platform')
      || request?.headers.get('x-app-platform'),
  ).toLowerCase();
  if (['website', 'web', 'official_site', '官网'].includes(explicit)) return '官网';
  if (['mini', 'miniprogram', 'wechat_mini', '小程序'].includes(explicit)) return '小程序';
  const referer = cleanText(request?.headers.get('referer') || request?.headers.get('origin')).toLowerCase();
  const userAgent = cleanText(request?.headers.get('user-agent')).toLowerCase();
  const secFetchSite = cleanText(request?.headers.get('sec-fetch-site')).toLowerCase();
  if (referer.includes('swod.com.cn') && !referer.includes('admin.swod.com.cn')) return '官网';
  if (userAgent.includes('miniprogram') || userAgent.includes('micromessenger') || secFetchSite === 'none') return '小程序';
  return '官网';
}

export function recordSeriesVisit(db: AdminDb, seriesId: number, memberId: number, source = 'learn', request?: Request) {
  if (!seriesId) return;
  const visitor = memberId > 0 ? null : visitorIdentity(request);
  const identityMemberId = memberId > 0 ? memberId : visitor?.memberId || 0;
  if (!identityMemberId) return;
  const visitSource = cleanText(source, 'learn').slice(0, 40);
  const platform = visitPlatform(request);
  db.transaction(() => {
    db.prepare(
      `INSERT INTO CourseSeriesVisitLog (member_id, series_id, source, platform, visitor_key, visitor_label, visited_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now','localtime'), datetime('now','localtime'))`
    ).run(identityMemberId, seriesId, visitSource, platform, visitor?.key || '', visitor?.label || '');
    db.prepare(
      `INSERT INTO CourseSeriesVisit (member_id, series_id, source, platform, visitor_key, visitor_label, first_visited_at, last_visited_at, visit_count)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now','localtime'), datetime('now','localtime'), 1)
       ON CONFLICT(member_id, series_id) DO UPDATE SET
         last_visited_at=excluded.last_visited_at,
         platform=excluded.platform,
         visitor_key=CASE WHEN excluded.visitor_key<>'' THEN excluded.visitor_key ELSE CourseSeriesVisit.visitor_key END,
         visitor_label=CASE WHEN excluded.visitor_label<>'' THEN excluded.visitor_label ELSE CourseSeriesVisit.visitor_label END,
         source=CASE
           WHEN excluded.source='auth_request' THEN excluded.source
           WHEN COALESCE(CourseSeriesVisit.source, '')='' THEN excluded.source
           ELSE CourseSeriesVisit.source
         END,
         visit_count=CourseSeriesVisit.visit_count + 1`
    ).run(identityMemberId, seriesId, visitSource, platform, visitor?.key || '', visitor?.label || '');
  })();
}

function isEnabled(value: unknown) {
  return value === true || value === 1 || value === '1' || String(value || '').toLowerCase() === 'true';
}

export function getActiveAuthorization(db: AdminDb, seriesId: number, memberId: number, phone = '') {
  if (!seriesId || (!memberId && !phone)) return null;
  return db.prepare(
    `SELECT id, type, granted_at, granted_by, expire_at
     FROM CourseAuthorization
     WHERE series_id=? AND status='active'
       AND (member_id=? OR (COALESCE(phone,'')<>'' AND phone=?))
       AND (expire_at IS NULL OR expire_at > datetime('now','localtime'))
     ORDER BY CASE WHEN member_id=? THEN 0 ELSE 1 END, id DESC
     LIMIT 1`
  ).get(seriesId, memberId, phone || '', memberId) || null;
}

function trialVideoIds(db: AdminDb, seriesId: number, limit: number) {
  if (!seriesId || limit <= 0) return new Set<number>();
  const rows = db.prepare(
    `SELECT cv.id
     FROM CourseVideo cv
     JOIN OnlineCourse oc ON oc.id=cv.course_id
     WHERE oc.series_id=? AND oc.status='published'
       AND (cv.status IS NULL OR cv.status='' OR cv.status='published')
     ORDER BY oc.sort_order, oc.id, cv.sort_order, cv.id
     LIMIT ?`
  ).all<{ id: number }>(seriesId, limit);
  return new Set(rows.map(row => Number(row.id)).filter(Boolean));
}

export function getSeriesAccessStatus(db: AdminDb, seriesId: number, memberId: number, phone = '') {
  const series = db.prepare(
    `SELECT id, status, is_free, trial_count
     FROM CourseSeries
     WHERE id=?
     LIMIT 1`
  ).get<{ id: number; status?: string; is_free?: unknown; trial_count?: unknown }>(seriesId);

  if (!series || series.status !== 'published') {
    return {
      authorized: false,
      auth_type: null as string | null,
      trial_available: false,
      reason: 'not_found',
      message: '课程不存在或未发布',
    };
  }

  const auth = getActiveAuthorization(db, seriesId, memberId, phone);
  const freeTrialCourses = db.prepare(
    `SELECT COUNT(*) AS count
     FROM OnlineCourse
     WHERE series_id=? AND status='published' AND is_free_trial=1`
  ).get<{ count: number }>(seriesId)?.count || 0;
  const trialCount = Number(series.trial_count || 0);
  const isFree = isEnabled(series.is_free);

  return {
    authorized: Boolean(isFree || auth),
    auth_type: auth?.type || (isFree ? 'free' : null),
    trial_available: trialCount > 0 || freeTrialCourses > 0,
    trial_count: trialCount,
    reason: isFree ? 'free' : auth ? 'authorized' : 'locked',
    message: isFree || auth ? '' : '请先申请授权观看完整学习',
  };
}

export function getVideoAccessStatus(db: AdminDb, videoId: number, memberId: number, phone = '') {
  const row = db.prepare(
    `SELECT cv.id, cv.is_free AS video_is_free, cv.status AS video_status,
            oc.id AS course_id, oc.series_id, oc.is_free_trial AS course_is_free_trial, oc.status AS course_status,
            cs.status AS series_status, cs.is_free AS series_is_free, cs.trial_count
     FROM CourseVideo cv
     LEFT JOIN OnlineCourse oc ON oc.id=cv.course_id
     LEFT JOIN CourseSeries cs ON cs.id=oc.series_id
     WHERE cv.id=?
     LIMIT 1`
  ).get<Record<string, any>>(videoId);

  if (!row || row.series_status !== 'published' || row.course_status !== 'published' || (row.video_status && row.video_status !== 'published')) {
    return {
      authorized: false,
      series_id: Number(row?.series_id || 0),
      auth_type: null as string | null,
      reason: 'not_found',
      message: '课节不存在或未发布',
    };
  }

  const seriesId = Number(row.series_id || 0);
  const auth = getActiveAuthorization(db, seriesId, memberId, phone);
  const isSeriesFree = isEnabled(row.series_is_free);
  const isCourseTrial = isEnabled(row.course_is_free_trial);
  const isVideoFree = isEnabled(row.video_is_free);
  const trialCount = Number(row.trial_count || 0);
  const isWithinTrialCount = trialVideoIds(db, seriesId, trialCount).has(videoId);
  const authorized = Boolean(auth || isSeriesFree || isCourseTrial || isVideoFree || isWithinTrialCount);

  return {
    authorized,
    series_id: seriesId,
    auth_type: auth?.type || (isSeriesFree ? 'free' : (isCourseTrial || isVideoFree || isWithinTrialCount) ? 'trial' : null),
    trial_available: trialCount > 0 || isCourseTrial || isVideoFree,
    reason: auth
      ? 'authorized'
      : isSeriesFree
        ? 'free'
        : (isCourseTrial || isVideoFree || isWithinTrialCount)
          ? 'trial'
          : 'locked',
    message: authorized ? '' : '请先申请授权观看完整学习',
  };
}

function columns(db: AdminDb, table: string) {
  return db.prepare(`PRAGMA table_info('${table.replace(/'/g, "''")}')`).all<{ name: string }>().map((row) => row.name);
}

function addColumn(db: AdminDb, table: string, column: string, ddl: string) {
  if (!columns(db, table).includes(column)) db.prepare(`ALTER TABLE ${table} ADD COLUMN ${ddl}`).run();
}

export function ensureMiniTables(db: AdminDb) {
  ensureWechatIdentityTables(db);
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
  db.prepare(`CREATE TABLE IF NOT EXISTS MemberDeviceSession (
    id TEXT PRIMARY KEY,
    member_id INTEGER NOT NULL,
    device_hash TEXT NOT NULL,
    login_method TEXT NOT NULL DEFAULT 'phone',
    created_at_ms INTEGER NOT NULL,
    last_seen_at_ms INTEGER NOT NULL,
    expires_at_ms INTEGER NOT NULL,
    absolute_expires_at_ms INTEGER NOT NULL,
    revoked_at_ms INTEGER NOT NULL DEFAULT 0,
    revoke_reason TEXT NOT NULL DEFAULT ''
  )`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS WechatLoginHandoff (
    id TEXT PRIMARY KEY,
    poll_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    session_id TEXT NOT NULL DEFAULT '',
    session_token TEXT NOT NULL DEFAULT '',
    device_secret TEXT NOT NULL DEFAULT '',
    session_expires_at_ms INTEGER NOT NULL DEFAULT 0,
    member_id INTEGER NOT NULL DEFAULT 0,
    member_json TEXT NOT NULL DEFAULT '',
    error_message TEXT NOT NULL DEFAULT '',
    created_at_ms INTEGER NOT NULL,
    expires_at_ms INTEGER NOT NULL,
    completed_at_ms INTEGER NOT NULL DEFAULT 0,
    consumed_at_ms INTEGER NOT NULL DEFAULT 0
  )`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS CourseSeriesVisit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL,
    series_id INTEGER NOT NULL,
    source TEXT DEFAULT 'learn',
    platform TEXT DEFAULT '',
    visitor_key TEXT DEFAULT '',
    visitor_label TEXT DEFAULT '',
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
    platform TEXT DEFAULT '',
    visitor_key TEXT DEFAULT '',
    visitor_label TEXT DEFAULT '',
    visited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS VideoProgress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL,
    video_id INTEGER NOT NULL,
    progress REAL NOT NULL DEFAULT 0,
    duration REAL NOT NULL DEFAULT 0,
    completed INTEGER NOT NULL DEFAULT 0,
    platform TEXT DEFAULT '',
    last_play_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(member_id, video_id)
  )`).run();
  addColumn(db, 'CourseSeriesVisit', 'visitor_key', "visitor_key TEXT DEFAULT ''");
  addColumn(db, 'CourseSeriesVisit', 'visitor_label', "visitor_label TEXT DEFAULT ''");
  addColumn(db, 'CourseSeriesVisit', 'platform', "platform TEXT DEFAULT ''");
  addColumn(db, 'CourseSeriesVisitLog', 'visitor_key', "visitor_key TEXT DEFAULT ''");
  addColumn(db, 'CourseSeriesVisitLog', 'visitor_label', "visitor_label TEXT DEFAULT ''");
  addColumn(db, 'CourseSeriesVisitLog', 'platform', "platform TEXT DEFAULT ''");
  addColumn(db, 'VideoProgress', 'platform', "platform TEXT DEFAULT ''");
  addColumn(db, 'Member', 'avatar', "avatar TEXT DEFAULT ''");
  addColumn(db, 'Member', 'wx_nickname', "wx_nickname TEXT DEFAULT ''");
  addColumn(db, 'Member', 'wx_name', "wx_name TEXT DEFAULT ''");
  addColumn(db, 'Member', 'wx_account', "wx_account TEXT DEFAULT ''");
  addColumn(db, 'Member', 'wx_avatar_url', "wx_avatar_url TEXT DEFAULT ''");
  addColumn(db, 'Member', 'wx_openid', "wx_openid TEXT DEFAULT ''");
  addColumn(db, 'Member', 'wx_unionid', "wx_unionid TEXT DEFAULT ''");
  addColumn(db, 'Member', 'wx_session_key', "wx_session_key TEXT DEFAULT ''");
  addColumn(db, 'Member', 'wx_session_updated_at', 'wx_session_updated_at DATETIME DEFAULT NULL');
  addColumn(db, 'Member', 'wx_profile_synced_at', 'wx_profile_synced_at DATETIME DEFAULT NULL');
  addColumn(db, 'Member', 'phone_country_code', "phone_country_code TEXT DEFAULT ''");
  addColumn(db, 'Member', 'phone_national_number', "phone_national_number TEXT DEFAULT ''");

  // 性能索引
  db.exec("CREATE INDEX IF NOT EXISTS idx_study_note_member ON StudyNote(member_id, video_id, created_at)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_video_bookmark_member ON VideoBookmark(member_id, video_id, created_at)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_practice_checkin_member ON PracticeCheckin(member_id, checkin_date)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_mini_sms_code_phone ON MiniSmsCode(phone, used, expires_at)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_member_device_session_member ON MemberDeviceSession(member_id, revoked_at_ms, expires_at_ms)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_wechat_login_handoff_expiry ON WechatLoginHandoff(expires_at_ms, consumed_at_ms)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_question_series ON Question(series_id, created_at)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_answer_question ON Answer(question_id, created_at)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_course_series_visit_series ON CourseSeriesVisit(series_id, first_visited_at)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_course_series_visit_member ON CourseSeriesVisit(member_id, last_visited_at)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_course_series_visit_visitor ON CourseSeriesVisit(series_id, visitor_key, last_visited_at)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_course_series_visit_log_series_member ON CourseSeriesVisitLog(series_id, member_id, visited_at)");
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
  return sessionToken(member);
}

export function createMemberDeviceSession(
  db: AdminDb,
  member: { id: unknown; phone?: unknown },
  request: Request,
  loginMethod: 'phone' | 'wechat' | 'qr' | 'mini_handoff' | 'legacy' = 'phone',
): MemberDeviceSession {
  const memberId = toPositiveInt(member.id, 0);
  if (!memberId) throw new Error('学员账号无效');
  const now = Date.now();
  const id = crypto.randomUUID();
  const deviceSecret = readCookie(request, MEMBER_DEVICE_COOKIE) || crypto.randomBytes(32).toString('base64url');
  const currentDeviceHash = deviceHash(deviceSecret);
  db.transaction(() => {
    db.prepare(
      `UPDATE MemberDeviceSession
       SET revoked_at_ms=?, revoke_reason='replaced_by_new_login'
       WHERE member_id=? AND device_hash=? AND revoked_at_ms=0`
    ).run(now, memberId, currentDeviceHash);
    db.prepare(
      `INSERT INTO MemberDeviceSession (
         id, member_id, device_hash, login_method, created_at_ms, last_seen_at_ms,
         expires_at_ms, absolute_expires_at_ms, revoked_at_ms, revoke_reason
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, '')`
    ).run(
      id,
      memberId,
      currentDeviceHash,
      loginMethod,
      now,
      now,
      now + MEMBER_SESSION_TTL_MS,
      now + MEMBER_SESSION_ABSOLUTE_TTL_MS,
    );
  })();
  return {
    id,
    memberId,
    token: sessionToken(member, id),
    deviceSecret,
    expiresAt: now + MEMBER_SESSION_TTL_MS,
  };
}

export function renewMemberDeviceSession(
  db: AdminDb,
  member: { id: unknown; phone?: unknown },
  request: Request,
): MemberDeviceSession | null {
  const memberId = toPositiveInt(member.id, 0);
  if (!memberId) return null;
  const requestTokens = [
    request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim(),
    readCookie(request, MEMBER_SESSION_COOKIE),
  ].filter(Boolean) as string[];
  const deviceSecret = readCookie(request, MEMBER_DEVICE_COOKIE);

  for (const token of requestTokens) {
    // A device-bound session can be re-signed after a key rotation once the
    // database session and device secret have independently been verified.
    const payload = parseMemberToken(token) || parseUnverifiedDeviceToken(token);
    if (!payload || payload.id !== memberId || !payload.sid || !deviceSecret) continue;
    const now = Date.now();
    const session = db.prepare(
      `SELECT id, device_hash, absolute_expires_at_ms
       FROM MemberDeviceSession
       WHERE id=? AND member_id=? AND revoked_at_ms=0 AND expires_at_ms>? AND absolute_expires_at_ms>?
       LIMIT 1`
    ).get<{ id: string; device_hash: string; absolute_expires_at_ms: number }>(payload.sid, memberId, now, now);
    if (!session || session.device_hash !== deviceHash(deviceSecret)) continue;
    const expiresAt = Math.min(now + MEMBER_SESSION_TTL_MS, Number(session.absolute_expires_at_ms));
    db.prepare(
      `UPDATE MemberDeviceSession SET last_seen_at_ms=?, expires_at_ms=? WHERE id=?`
    ).run(now, expiresAt, session.id);
    return {
      id: session.id,
      memberId,
      token: sessionToken(member, session.id),
      deviceSecret,
      expiresAt,
    };
  }

  // A valid legacy token is transparently migrated without asking the learner
  // to sign in again.
  const legacyToken = requestTokens.find(token => {
    const payload = parseMemberToken(token);
    return payload?.id === memberId && !payload.sid;
  });
  return legacyToken ? createMemberDeviceSession(db, member, request, 'legacy') : null;
}

export function revokeMemberDeviceSession(db: AdminDb, request: Request) {
  const token = readCookie(request, MEMBER_SESSION_COOKIE)
    || request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
    || '';
  const payload = parseMemberToken(token);
  if (!payload?.sid) return;
  db.prepare(
    `UPDATE MemberDeviceSession
     SET revoked_at_ms=?, revoke_reason='logout'
     WHERE id=? AND revoked_at_ms=0`
  ).run(Date.now(), payload.sid);
}

function cookieHeader(name: string, value: string, maxAge: number) {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${Math.max(0, Math.floor(maxAge))}; HttpOnly; Secure; SameSite=Lax`;
}

export function attachMemberSessionCookies(response: Response, session: MemberDeviceSession) {
  const maxAge = Math.max(1, Math.ceil((session.expiresAt - Date.now()) / 1000));
  response.headers.append('Set-Cookie', cookieHeader(MEMBER_SESSION_COOKIE, session.token, maxAge));
  response.headers.append('Set-Cookie', cookieHeader(MEMBER_DEVICE_COOKIE, session.deviceSecret, 365 * 86400));
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export function clearMemberSessionCookie(response: Response) {
  response.headers.append('Set-Cookie', cookieHeader(MEMBER_SESSION_COOKIE, '', 0));
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
