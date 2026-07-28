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

  const series = db.prepare('SELECT id, is_free FROM CourseSeries WHERE id=?').get<{ id: number; is_free?: number }>(seriesId);
  if (!series) {
    return { authorized: false, trial_available: false, reason: 'not_found', message: '课程不存在' };
  }

  if (Number(series.is_free || 0) === 1) {
    return { authorized: true, trial_available: true, reason: 'free_series', auth_type: 'free_series' };
  }

  const authorization = getActiveAuthorization(db, seriesId, memberId, phone);
  if (authorization) {
    return { authorized: true, trial_available: false, reason: 'authorized', auth_type: authorization.type || 'admin_grant' };
  }

  return { authorized: false, trial_available: false, reason: 'unauthorized', message: '请先申请授权观看完整学习' };
}

export function getVideoAccessStatus(db: AdminDb, videoId: number, memberId: number, phone = '') {
  if (!videoId) {
    return { authorized: false, trial_available: false, reason: 'not_found', message: '视频不存在' };
  }

  const video = db.prepare(
    `SELECT cv.id, cv.is_free, oc.series_id, cs.is_free as series_is_free
     FROM CourseVideo cv
     LEFT JOIN OnlineCourse oc ON oc.id=cv.course_id
     LEFT JOIN CourseSeries cs ON cs.id=oc.series_id
     WHERE cv.id=?`
  ).get<{ id: number; is_free?: number; series_id?: number; series_is_free?: number }>(videoId);

  if (!video) {
    return { authorized: false, trial_available: false, reason: 'not_found', message: '视频不存在' };
  }

  if (Number(video.is_free || 0) === 1 || Number(video.series_is_free || 0) === 1) {
    return { authorized: true, trial_available: true, reason: 'free_video', auth_type: 'free_video' };
  }

  return getSeriesAccessStatus(db, Number(video.series_id || 0), memberId, phone);
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
  db.exec("CREATE INDEX IF NOT EXISTS idx_course_series_visit_series ON CourseSeriesVisit(series_id, first_visited_at)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_course_series_visit_member ON CourseSeriesVisit(member_id, last_visited_at)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_course_series_visit_log_series_member ON CourseSeriesVisitLog(series_id, member_id, visited_at)");
}

export function ensureAuthorizationAuditColumns(db: AdminDb) {
  const columns = new Set((db.prepare('PRAGMA table_info(CourseAuthorization)').all() as Array<{ name: string }>).map(column => column.name));
  if (!columns.has('granted_by')) db.exec('ALTER TABLE CourseAuthorization ADD COLUMN granted_by INTEGER');
  if (!columns.has('revoked_by')) db.exec('ALTER TABLE CourseAuthorization ADD COLUMN revoked_by INTEGER');
  if (!columns.has('revoked_at')) db.exec('ALTER TABLE CourseAuthorization ADD COLUMN revoked_at DATETIME');
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
