import type { AdminDb } from '@/lib/server/admin-db';
import { createAuthorizationMessage } from '@/lib/server/inbox';

export function activeAuthWhere() {
  return "ca.status='active' AND (ca.expire_at IS NULL OR ca.expire_at > datetime('now','localtime'))";
}

export function activeAuthJoin(memberAlias = 'm') {
  return `ca.series_id=? AND ${activeAuthWhere()}
    AND (
      ca.member_id=${memberAlias}.id
      OR (COALESCE(ca.phone,'')<>'' AND COALESCE(${memberAlias}.phone,'')<>'' AND ca.phone=${memberAlias}.phone)
    )`;
}

export function getActiveAuthorization(db: AdminDb, seriesId: number, memberId: number, phone = '') {
  if (!seriesId || (!memberId && !phone)) return null;
  ensureAuthorizationAuditColumns(db);
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

export function getSeriesAccessStatus(db: AdminDb, seriesId: number, memberId: number, phone = '') {
  if (!seriesId) {
    return { authorized: false, trial_available: false, reason: 'not_found', message: '课程不存在' };
  }

  const series = db.prepare(
    "SELECT id, status, is_free, trial_count FROM CourseSeries WHERE id=?"
  ).get<{ id: number; status?: string; is_free?: number; trial_count?: number }>(seriesId);
  if (!series || series.status !== 'published') {
    return { authorized: false, trial_available: false, reason: 'not_found', message: '课程不存在' };
  }

  const freeTrialCourses = db.prepare(
    "SELECT COUNT(*) AS count FROM OnlineCourse WHERE series_id=? AND status='published' AND is_free_trial=1"
  ).get<{ count: number }>(seriesId)?.count || 0;
  const trialCount = Number(series.trial_count || 0);

  if (Number(series.is_free || 0) === 1) {
    return { authorized: true, trial_available: true, trial_count: trialCount, reason: 'free', auth_type: 'free' };
  }

  const authorization = getActiveAuthorization(db, seriesId, memberId, phone);
  if (authorization) {
    return {
      authorized: true,
      trial_available: trialCount > 0 || freeTrialCourses > 0,
      trial_count: trialCount,
      reason: 'authorized',
      auth_type: authorization.type || 'admin_grant',
    };
  }

  return {
    authorized: false,
    trial_available: trialCount > 0 || freeTrialCourses > 0,
    trial_count: trialCount,
    reason: 'locked',
    auth_type: null,
    message: '请先申请授权观看完整学习',
  };
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

export function getVideoAccessStatus(db: AdminDb, videoId: number, memberId: number, phone = '') {
  if (!videoId) {
    return { authorized: false, trial_available: false, reason: 'not_found', message: '视频不存在' };
  }

  const video = db.prepare(
    `SELECT cv.id, cv.is_free, cv.status as video_status,
            oc.series_id, oc.is_free_trial, oc.status as course_status,
            cs.status as series_status, cs.is_free as series_is_free, cs.trial_count
     FROM CourseVideo cv
     LEFT JOIN OnlineCourse oc ON oc.id=cv.course_id
     LEFT JOIN CourseSeries cs ON cs.id=oc.series_id
     WHERE cv.id=?`
  ).get<{
    id: number;
    is_free?: number;
    video_status?: string;
    series_id?: number;
    is_free_trial?: number;
    course_status?: string;
    series_status?: string;
    series_is_free?: number;
    trial_count?: number;
  }>(videoId);

  if (
    !video
    || video.series_status !== 'published'
    || video.course_status !== 'published'
    || (video.video_status && video.video_status !== 'published')
  ) {
    return { authorized: false, trial_available: false, reason: 'not_found', message: '视频不存在' };
  }

  const seriesId = Number(video.series_id || 0);
  const authorization = getActiveAuthorization(db, seriesId, memberId, phone);
  const isSeriesFree = Number(video.series_is_free || 0) === 1;
  const isCourseTrial = Number(video.is_free_trial || 0) === 1;
  const isVideoFree = Number(video.is_free || 0) === 1;
  const trialCount = Number(video.trial_count || 0);
  const isWithinTrialCount = trialVideoIds(db, seriesId, trialCount).has(videoId);
  const authorized = Boolean(authorization || isSeriesFree || isCourseTrial || isVideoFree || isWithinTrialCount);
  const isTrial = isCourseTrial || isVideoFree || isWithinTrialCount;

  return {
    authorized,
    series_id: seriesId,
    trial_available: trialCount > 0 || isCourseTrial || isVideoFree,
    reason: authorization ? 'authorized' : isSeriesFree ? 'free' : isTrial ? 'trial' : 'locked',
    auth_type: authorization?.type || (isSeriesFree ? 'free' : isTrial ? 'trial' : null),
    message: authorized ? '' : '请先申请授权观看完整学习',
  };
}

export function ensureCourseSeriesVisitTable(db: AdminDb) {
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
  const logColumns = new Set(
    (db.prepare('PRAGMA table_info(CourseSeriesVisitLog)').all() as Array<{ name: string }>).map(column => column.name)
  );
  const trackingColumns = [
    ['platform', "platform TEXT DEFAULT ''"],
    ['visitor_key', "visitor_key TEXT DEFAULT ''"],
    ['visitor_label', "visitor_label TEXT DEFAULT ''"],
    ['phone', "phone TEXT DEFAULT ''"],
    ['wx_unionid', "wx_unionid TEXT DEFAULT ''"],
    ['page_url', "page_url TEXT DEFAULT ''"],
    ['ip_address', "ip_address TEXT DEFAULT ''"],
    ['ip_region', "ip_region TEXT DEFAULT ''"],
    ['referrer_member_id', 'referrer_member_id INTEGER'],
    ['referrer_channel', "referrer_channel TEXT DEFAULT ''"],
    ['referrer_url', "referrer_url TEXT DEFAULT ''"],
    ['share_code', "share_code TEXT DEFAULT ''"],
  ] as const;
  trackingColumns.forEach(([name, ddl]) => {
    if (!logColumns.has(name)) db.exec(`ALTER TABLE CourseSeriesVisitLog ADD COLUMN ${ddl}`);
  });
  db.exec("CREATE INDEX IF NOT EXISTS idx_course_series_visit_series ON CourseSeriesVisit(series_id, first_visited_at)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_course_series_visit_member ON CourseSeriesVisit(member_id, last_visited_at)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_course_series_visit_log_series_member ON CourseSeriesVisitLog(series_id, member_id, visited_at)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_course_series_visit_log_referrer ON CourseSeriesVisitLog(referrer_member_id, visited_at)");
}

export function ensureAuthorizationAuditColumns(db: AdminDb) {
  const columns = new Set((db.prepare('PRAGMA table_info(CourseAuthorization)').all() as Array<{ name: string }>).map(column => column.name));
  if (!columns.has('granted_by')) db.exec('ALTER TABLE CourseAuthorization ADD COLUMN granted_by INTEGER');
  if (!columns.has('revoked_by')) db.exec('ALTER TABLE CourseAuthorization ADD COLUMN revoked_by INTEGER');
  if (!columns.has('revoked_at')) db.exec('ALTER TABLE CourseAuthorization ADD COLUMN revoked_at DATETIME');
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_course_authorization_series_member_id
      ON CourseAuthorization(series_id, member_id, id DESC);
    CREATE INDEX IF NOT EXISTS idx_course_authorization_series_phone_id
      ON CourseAuthorization(series_id, phone, id DESC);
    CREATE INDEX IF NOT EXISTS idx_course_authorization_status_series
      ON CourseAuthorization(status, series_id, id DESC);
  `);
}

export function authorizeMembers(db: AdminDb, seriesId: number, memberIds: number[], grantedBy = 1) {
  ensureAuthorizationAuditColumns(db);
  const ids = Array.from(new Set(memberIds.filter(id => Number.isInteger(id) && id > 0)));
  if (!ids.length) return { authorized: 0 };

  const getMember = db.prepare('SELECT id, phone FROM Member WHERE id=?');
  const revoke = db.prepare(
    "UPDATE CourseAuthorization SET status='revoked', revoked_at=datetime('now','localtime'), revoked_by=? WHERE series_id=? AND status='active' AND (member_id=? OR (COALESCE(phone,'')<>'' AND phone=?))"
  );
  const insert = db.prepare(
    "INSERT INTO CourseAuthorization (member_id, phone, series_id, type, granted_by, granted_at, status) VALUES (?, ?, ?, 'admin_grant', ?, datetime('now','localtime'), 'active')"
  );

  return db.transaction(() => {
    let count = 0;
    ids.forEach(id => {
      const member = getMember.get(id) as any;
      if (!member) return;
      revoke.run(grantedBy, seriesId, id, member.phone || '');
      const authorization = insert.run(id, member.phone || '', seriesId, grantedBy);
      createAuthorizationMessage(db, id, seriesId, authorization.lastInsertRowid);
      count += 1;
    });
    return { authorized: count };
  })();
}

export function deauthorizeMembers(db: AdminDb, seriesId: number, memberIds: number[], revokedBy = 1) {
  ensureAuthorizationAuditColumns(db);
  const ids = Array.from(new Set(memberIds.filter(id => Number.isInteger(id) && id > 0)));
  if (!ids.length) return { deauthorized: 0 };

  return db.transaction(() => {
    const getMember = db.prepare('SELECT phone FROM Member WHERE id=?');
    const revoke = db.prepare(
      `UPDATE CourseAuthorization
       SET status='revoked', revoked_at=datetime('now','localtime'), revoked_by=?
       WHERE series_id=? AND status='active'
         AND (member_id=? OR (COALESCE(phone,'')<>'' AND phone=?))`
    );
    let count = 0;
    ids.forEach(id => {
      const member = getMember.get(id) as { phone?: string } | undefined;
      count += Number(revoke.run(revokedBy, seriesId, id, member?.phone || '').changes || 0);
    });
    return { deauthorized: count };
  })();
}

export function deauthorizeMemberIdentity(db: AdminDb, seriesId: number, memberId: number, phone = '', revokedBy = 1) {
  ensureAuthorizationAuditColumns(db);
  if (!seriesId || (!memberId && !phone)) return { deauthorized: 0 };
  const member = memberId ? db.prepare('SELECT phone FROM Member WHERE id=?').get<{ phone?: string }>(memberId) : null;
  const authPhone = phone || member?.phone || '';
  const result = db.prepare(
    `UPDATE CourseAuthorization
     SET status='revoked', revoked_at=datetime('now','localtime'), revoked_by=?
     WHERE series_id=? AND status='active'
       AND (member_id=? OR (COALESCE(phone,'')<>'' AND phone=?))`
  ).run(revokedBy, seriesId, memberId || 0, authPhone);
  return { deauthorized: Number(result.changes || 0) };
}
