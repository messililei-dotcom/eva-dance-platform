import { notifyAuthorizationRevocation } from '@/lib/server/authorization-revocation';
import { authorizationFinancials, ensureAuthorizationCommissionColumns } from '@/lib/server/authorization-commission';
import type { AdminDb } from '@/lib/server/admin-db';
import { reconcileMemberAuthorizations } from '@/lib/server/student-growth';
import { createAuthorizationMessage } from '@/lib/server/inbox';
import { normalizeAuthorizationVouchers, type AuthorizationVoucher } from '@/lib/server/authorization-vouchers';

const AUTO_AUTH_INCOME_MARKER = 'AUTO_ONLINE_AUTH_INCOME';

function tableExists(db: AdminDb, table: string) {
  return Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table));
}

function tableColumns(db: AdminDb, table: string) {
  if (!tableExists(db, table)) return new Set<string>();
  return new Set((db.prepare(`PRAGMA table_info('${table.replace(/'/g, "''")}')`).all() as Array<{ name: string }>).map(column => column.name));
}

function addColumn(db: AdminDb, table: string, column: string, definition: string) {
  const columns = tableColumns(db, table);
  if (!columns.has(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
}

function cleanText(value: unknown, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function toAmount(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function ensureFinanceIncomeTable(db: AdminDb) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS FinanceIncome (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      incomeNo TEXT,
      incomeDate TEXT,
      category TEXT DEFAULT '线上课程',
      amount REAL NOT NULL DEFAULT 0,
      account TEXT DEFAULT '',
      payer TEXT DEFAULT '',
      memberId INTEGER DEFAULT 0,
      memberName TEXT DEFAULT '',
      orderId INTEGER DEFAULT 0,
      handler TEXT DEFAULT '',
      remark TEXT DEFAULT '',
      voucherPath TEXT DEFAULT '',
      createdBy TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  addColumn(db, 'FinanceIncome', 'incomeNo', 'incomeNo TEXT');
  addColumn(db, 'FinanceIncome', 'incomeDate', 'incomeDate TEXT');
  addColumn(db, 'FinanceIncome', 'category', "category TEXT DEFAULT '线上课程'");
  addColumn(db, 'FinanceIncome', 'amount', 'amount REAL NOT NULL DEFAULT 0');
  addColumn(db, 'FinanceIncome', 'account', "account TEXT DEFAULT ''");
  addColumn(db, 'FinanceIncome', 'payer', "payer TEXT DEFAULT ''");
  addColumn(db, 'FinanceIncome', 'memberId', 'memberId INTEGER DEFAULT 0');
  addColumn(db, 'FinanceIncome', 'memberName', "memberName TEXT DEFAULT ''");
  addColumn(db, 'FinanceIncome', 'orderId', 'orderId INTEGER DEFAULT 0');
  addColumn(db, 'FinanceIncome', 'handler', "handler TEXT DEFAULT ''");
  addColumn(db, 'FinanceIncome', 'remark', "remark TEXT DEFAULT ''");
  addColumn(db, 'FinanceIncome', 'voucherPath', "voucherPath TEXT DEFAULT ''");
  addColumn(db, 'FinanceIncome', 'createdBy', "createdBy TEXT DEFAULT ''");
  addColumn(db, 'FinanceIncome', 'created_at', 'created_at DATETIME DEFAULT CURRENT_TIMESTAMP');
  addColumn(db, 'FinanceIncome', 'updated_at', 'updated_at DATETIME DEFAULT CURRENT_TIMESTAMP');
  addColumn(db, 'FinanceIncome', 'title', "title TEXT DEFAULT ''");
  addColumn(db, 'FinanceIncome', 'income_date', "income_date TEXT DEFAULT ''");
  addColumn(db, 'FinanceIncome', 'payment_method', "payment_method TEXT DEFAULT ''");
}

export function recordAuthorizationIncome(db: AdminDb, authorizationId: number) {
  ensureFinanceIncomeTable(db);
  ensureAuthorizationCommissionColumns(db);
  db.exec('CREATE INDEX IF NOT EXISTS idx_finance_income_no ON FinanceIncome(incomeNo)');
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_income_auth_no ON FinanceIncome(incomeNo) WHERE incomeNo LIKE 'AUTH-%'");
  const auth = db.prepare(`
    SELECT
      ca.id,
      ca.member_id,
      ca.phone,
      ca.granted_at,
      ca.granted_by,
      ca.actual_amount,
      cs.id AS series_id,
      cs.name AS series_name,
      cs.price,
      cs.promo_price,
      m.name AS member_name,
      m.phone AS member_phone
    FROM CourseAuthorization ca
    JOIN CourseSeries cs ON cs.id = ca.series_id
    LEFT JOIN Member m ON m.id = ca.member_id
    WHERE ca.id = ?
    LIMIT 1
  `).get<{
    id: number;
    member_id?: number;
    phone?: string;
    granted_at?: string;
    granted_by?: number;
    actual_amount?: number | null;
    series_id?: number;
    series_name?: string;
    price?: number;
    promo_price?: number;
    member_name?: string;
    member_phone?: string;
  }>(authorizationId);
  if (!auth || auth.actual_amount == null || toAmount(auth.actual_amount) <= 0) return null;

  const marker = `${AUTO_AUTH_INCOME_MARKER}|authorization_id=${auth.id}`;
  const incomeDate = /^\d{4}-\d{2}-\d{2}/.test(String(auth.granted_at || ''))
    ? String(auth.granted_at).slice(0, 10)
    : (db.prepare("SELECT date('now','localtime') AS value").get<{ value?: string }>()?.value || new Date().toISOString().slice(0, 10));
  const memberName = cleanText(auth.member_name, cleanText(auth.phone || auth.member_phone, '线上课程学员'));
  const amount = toAmount(auth.actual_amount);
  const title = `线上课程授权收入：${cleanText(auth.series_name, `课程${auth.series_id || ''}`)}`;
  const remark = [
    `系统自动生成：线上课程授权收入`,
    `课程：${cleanText(auth.series_name, '-')}`,
    `学员：${memberName}`,
    `授权ID：${auth.id}`,
    marker,
  ].join('\n');
  const columns = tableColumns(db, 'FinanceIncome');
  // incomeNo is indexed, whereas searching the audit marker requires a full text scan.
  // Keep the marker fallback for records created by older releases.
  const existing = db.prepare("SELECT id, amount FROM FinanceIncome WHERE incomeNo = ? OR remark LIKE ? ORDER BY id DESC LIMIT 1")
    .get<{ id?: number; amount?: number }>(`AUTH-${auth.id}`, `%${marker}`);
  const valuesByColumn: Record<string, unknown> = {
    incomeNo: `AUTH-${auth.id}`,
    incomeDate,
    income_date: incomeDate,
    category: '线上课程',
    title,
    amount,
    account: '授权生成',
    payment_method: '授权生成',
    payer: memberName,
    memberId: Number(auth.member_id || 0),
    memberName,
    orderId: 0,
    handler: String(auth.granted_by || ''),
    remark,
    voucherPath: '',
    createdBy: 'system',
  };

  if (existing?.id) {
    db.prepare('DELETE FROM FinanceIncome WHERE remark LIKE ? AND id <> ?').run(`%${marker}`, existing.id);
    // Keep the compatibility copy aligned with the recorded receipt, never a course price.
    const updateColumns = Object.keys(valuesByColumn).filter(column => columns.has(column) && column !== 'incomeNo');
    const assignments = updateColumns.map(column => `${column} = ?`);
    const values = updateColumns.map(column => valuesByColumn[column]);
    if (columns.has('updated_at')) assignments.push("updated_at = datetime('now','localtime')");
    db.prepare(`UPDATE FinanceIncome SET ${assignments.join(', ')} WHERE id = ?`).run(...values, existing.id);
    return { incomeId: existing.id, amount };
  }

  const insertColumns = Object.keys(valuesByColumn).filter(column => columns.has(column));
  const placeholders = insertColumns.map(() => '?');
  const values = insertColumns.map(column => valuesByColumn[column]);
  if (columns.has('created_at')) {
    insertColumns.push('created_at');
    placeholders.push('?');
    values.push(cleanText(auth.granted_at, `${incomeDate} 00:00:00`));
  }
  if (columns.has('updated_at')) {
    insertColumns.push('updated_at');
    placeholders.push("datetime('now','localtime')");
  }
  const result = db.prepare(`
    INSERT INTO FinanceIncome (${insertColumns.join(', ')})
    VALUES (${placeholders.join(', ')})
  `).run(...values);
  return { incomeId: result.lastInsertRowid, amount };
}

/**
 * Makes historical course grants visible in 财务中心.  The operation is
 * idempotent: one CourseAuthorization maps to exactly one AUTH-{id} income.
 */
export function backfillAuthorizationIncomes(db: AdminDb) {
  if (!tableExists(db, 'CourseAuthorization') || !tableExists(db, 'CourseSeries')) return { created: 0 };
  ensureFinanceIncomeTable(db);
  db.exec('CREATE INDEX IF NOT EXISTS idx_course_authorization_series ON CourseAuthorization(series_id, id)');
  const legacyRows = db.prepare(`
    SELECT ca.id AS authorization_id, legacy.id AS income_id
    FROM CourseAuthorization ca
    JOIN FinanceIncome legacy
      ON legacy.remark LIKE ('%${AUTO_AUTH_INCOME_MARKER}|authorization_id=' || ca.id)
    LEFT JOIN FinanceIncome exact_income ON exact_income.incomeNo = ('AUTH-' || ca.id)
    WHERE exact_income.id IS NULL
    ORDER BY ca.id
  `).all() as Array<{ authorization_id: number; income_id: number }>;
  const missing = db.prepare(`
    SELECT ca.id
    FROM CourseAuthorization ca
    LEFT JOIN FinanceIncome fi ON fi.incomeNo = ('AUTH-' || ca.id)
    WHERE fi.id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM FinanceIncome legacy
        WHERE legacy.remark LIKE ('%${AUTO_AUTH_INCOME_MARKER}|authorization_id=' || ca.id)
      )
    ORDER BY ca.id
  `).all() as Array<{ id: number }>;

  return db.transaction(() => {
    let normalized = 0;
    legacyRows.forEach(row => {
      normalized += Number(db.prepare(
        "UPDATE FinanceIncome SET incomeNo=?, updated_at=datetime('now','localtime') WHERE id=?"
      ).run(`AUTH-${row.authorization_id}`, row.income_id).changes || 0);
    });
    let created = 0;
    missing.forEach(row => {
      if (recordAuthorizationIncome(db, Number(row.id))) created += 1;
    });
    return { created, normalized };
  })();
}

export function ensureCourseIdentityColumns(db: AdminDb) {
  if (tableExists(db, 'Member')) {
    addColumn(db, 'Member', 'wx_openid', "wx_openid TEXT DEFAULT ''");
    addColumn(db, 'Member', 'wx_unionid', "wx_unionid TEXT DEFAULT ''");
    addColumn(db, 'Member', 'wx_nickname', "wx_nickname TEXT DEFAULT ''");
    addColumn(db, 'Member', 'merged_to_member_id', "merged_to_member_id INTEGER DEFAULT 0");
  }
  if (tableExists(db, 'CourseAuthorization')) {
    addColumn(db, 'CourseAuthorization', 'wx_openid', "wx_openid TEXT DEFAULT ''");
    addColumn(db, 'CourseAuthorization', 'wx_unionid', "wx_unionid TEXT DEFAULT ''");
    db.exec("CREATE INDEX IF NOT EXISTS idx_course_auth_wx_openid ON CourseAuthorization(wx_openid) WHERE wx_openid <> ''");
    db.exec("CREATE INDEX IF NOT EXISTS idx_course_auth_wx_unionid ON CourseAuthorization(wx_unionid) WHERE wx_unionid <> ''");
  }
  if (tableExists(db, 'CourseSeriesVisit')) {
    addColumn(db, 'CourseSeriesVisit', 'phone', "phone TEXT DEFAULT ''");
    addColumn(db, 'CourseSeriesVisit', 'wx_openid', "wx_openid TEXT DEFAULT ''");
    addColumn(db, 'CourseSeriesVisit', 'wx_unionid', "wx_unionid TEXT DEFAULT ''");
    addColumn(db, 'CourseSeriesVisit', 'wx_name', "wx_name TEXT DEFAULT ''");
    db.exec("CREATE INDEX IF NOT EXISTS idx_course_series_visit_phone ON CourseSeriesVisit(phone)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_course_series_visit_wx_openid ON CourseSeriesVisit(wx_openid)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_course_series_visit_wx_unionid ON CourseSeriesVisit(wx_unionid)");
  }
  if (tableExists(db, 'CourseSeriesVisitLog')) {
    addColumn(db, 'CourseSeriesVisitLog', 'phone', "phone TEXT DEFAULT ''");
    addColumn(db, 'CourseSeriesVisitLog', 'wx_openid', "wx_openid TEXT DEFAULT ''");
    addColumn(db, 'CourseSeriesVisitLog', 'wx_unionid', "wx_unionid TEXT DEFAULT ''");
    addColumn(db, 'CourseSeriesVisitLog', 'wx_name', "wx_name TEXT DEFAULT ''");
    db.exec("CREATE INDEX IF NOT EXISTS idx_course_series_visit_log_phone ON CourseSeriesVisitLog(phone)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_course_series_visit_log_wx_openid ON CourseSeriesVisitLog(wx_openid)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_course_series_visit_log_wx_unionid ON CourseSeriesVisitLog(wx_unionid)");
  }
  if (tableExists(db, 'VideoProgress')) {
    addColumn(db, 'VideoProgress', 'phone', "phone TEXT DEFAULT ''");
    addColumn(db, 'VideoProgress', 'wx_openid', "wx_openid TEXT DEFAULT ''");
    addColumn(db, 'VideoProgress', 'wx_unionid', "wx_unionid TEXT DEFAULT ''");
    addColumn(db, 'VideoProgress', 'wx_name', "wx_name TEXT DEFAULT ''");
    db.exec("CREATE INDEX IF NOT EXISTS idx_video_progress_phone ON VideoProgress(phone)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_video_progress_wx_openid ON VideoProgress(wx_openid)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_video_progress_wx_unionid ON VideoProgress(wx_unionid)");
  }
}

export function normalizePhoneIdentity(value: unknown) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length === 13 && digits.startsWith('86')) return digits.slice(2);
  return digits;
}

export function normalizedPhoneSql(valueSql: string) {
  const digitsSql = `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(${valueSql}, ''), '+', ''), ' ', ''), '-', ''), '(', ''), ')', '')`;
  return `(CASE WHEN length(${digitsSql}) = 13 AND substr(${digitsSql}, 1, 2) = '86' THEN substr(${digitsSql}, 3) ELSE ${digitsSql} END)`;
}

export function activeAuthWhere() {
  return "ca.status='active' AND (ca.expire_at IS NULL OR ca.expire_at > datetime('now','localtime'))";
}

export function activeAuthJoin(memberAlias = 'm') {
  const authPhone = normalizedPhoneSql('ca.phone');
  const memberPhone = normalizedPhoneSql(`${memberAlias}.phone`);
  const memberNationalPhone = normalizedPhoneSql(`${memberAlias}.phone_national_number`);
  return `ca.series_id=? AND ${activeAuthWhere()}
    AND (
      ca.member_id=${memberAlias}.id
      OR (${authPhone}<>'' AND (${authPhone}=${memberPhone} OR ${authPhone}=${memberNationalPhone}))
      OR (COALESCE(ca.wx_openid, '')<>'' AND ca.wx_openid=COALESCE(${memberAlias}.wx_openid, ''))
      OR (COALESCE(ca.wx_unionid, '')<>'' AND ca.wx_unionid=COALESCE(${memberAlias}.wx_unionid, ''))
    )`;
}

type CourseAuthIdentity = {
  memberId: number;
  memberIds: number[];
  phones: string[];
  wxOpenid: string;
  wxUnionid: string;
};

function uniqueNonEmpty(values: string[]) {
  return Array.from(new Set(values.map(value => value.trim()).filter(Boolean)));
}

function remarkMergedToMemberId(value: unknown) {
  const match = cleanText(value).match(/member_id\s*=\s*(\d+)/i);
  return match ? Number(match[1]) || 0 : 0;
}

export function getCourseAuthIdentity(db: AdminDb, memberId: number, phone = ''): CourseAuthIdentity {
  ensureCourseIdentityColumns(db);
  let wxOpenid = '';
  let wxUnionid = '';
  const memberIds = memberId ? [memberId] : [];
  const phoneCandidates = [normalizePhoneIdentity(phone)];

  if (memberId) {
    const member = db.prepare('SELECT phone, phone_national_number, wx_openid, wx_unionid, status, merged_to_member_id, remark FROM Member WHERE id=?').get<{
      phone?: string;
      phone_national_number?: string;
      wx_openid?: string;
      wx_unionid?: string;
      status?: string;
      merged_to_member_id?: number;
      remark?: string;
    }>(memberId);
    phoneCandidates.push(normalizePhoneIdentity(member?.phone_national_number));
    phoneCandidates.push(normalizePhoneIdentity(member?.phone));
    wxOpenid = String(member?.wx_openid || '').trim();
    wxUnionid = String(member?.wx_unionid || '').trim();

    const mergedToMemberId = Number(member?.merged_to_member_id || 0) || remarkMergedToMemberId(member?.remark);
    if (mergedToMemberId > 0 && mergedToMemberId !== memberId) {
      const target = db.prepare('SELECT phone, phone_national_number, wx_openid, wx_unionid FROM Member WHERE id=?').get<{
        phone?: string;
        phone_national_number?: string;
        wx_openid?: string;
        wx_unionid?: string;
      }>(mergedToMemberId);
      memberIds.push(mergedToMemberId);
      phoneCandidates.push(normalizePhoneIdentity(target?.phone_national_number));
      phoneCandidates.push(normalizePhoneIdentity(target?.phone));
      if (!wxOpenid) wxOpenid = String(target?.wx_openid || '').trim();
      if (!wxUnionid) wxUnionid = String(target?.wx_unionid || '').trim();
    }
  }

  return {
    memberId,
    memberIds: Array.from(new Set(memberIds.filter(id => Number.isInteger(id) && id > 0))),
    phones: uniqueNonEmpty(phoneCandidates),
    wxOpenid,
    wxUnionid,
  };
}

function identityAuthWhere(identity: CourseAuthIdentity, tableAlias = '') {
  const prefix = tableAlias ? `${tableAlias}.` : '';
  const phoneColumn = normalizedPhoneSql(`${prefix}phone`);
  const memberMatches = identity.memberIds.length
    ? identity.memberIds.map(() => `${prefix}member_id=?`)
    : [`${prefix}member_id=?`];
  const phoneMatches = identity.phones.map(() => `(${phoneColumn}<>'' AND ${phoneColumn}=?)`);
  return [
    ...memberMatches,
    ...phoneMatches,
    `(COALESCE(${prefix}wx_openid, '')<>'' AND ?<>'' AND ${prefix}wx_openid=?)`,
    `(COALESCE(${prefix}wx_unionid, '')<>'' AND ?<>'' AND ${prefix}wx_unionid=?)`,
  ].join(' OR ');
}

function identityAuthValues(identity: CourseAuthIdentity) {
  return [
    ...(identity.memberIds.length ? identity.memberIds : [identity.memberId || 0]),
    ...identity.phones,
    identity.wxOpenid,
    identity.wxOpenid,
    identity.wxUnionid,
    identity.wxUnionid,
  ];
}

export function getActiveAuthorization(db: AdminDb, seriesId: number, memberId: number, phone = '') {
  ensureCourseIdentityColumns(db);
  ensureAuthorizationAuditColumns(db);
  const identity = getCourseAuthIdentity(db, memberId, phone);
  if (!seriesId || (!identity.memberId && !identity.phones.length && !identity.wxOpenid && !identity.wxUnionid)) return null;
  return db.prepare(
    `SELECT id, type, granted_at, granted_by, expire_at
     FROM CourseAuthorization
     WHERE series_id=? AND status='active'
       AND (${identityAuthWhere(identity)})
       AND (expire_at IS NULL OR expire_at > datetime('now','localtime'))
     ORDER BY CASE WHEN member_id=? THEN 0 ELSE 1 END, id DESC
     LIMIT 1`
  ).get(seriesId, ...identityAuthValues(identity), identity.memberId || 0) || null;
}

export function listAuthorizedSeriesForMember(db: AdminDb, memberId: number, phone = '') {
  ensureAuthorizationAuditColumns(db);
  const identity = getCourseAuthIdentity(db, memberId, phone);
  if (!identity.memberId && !identity.phones.length && !identity.wxOpenid && !identity.wxUnionid) return [];
  return db.prepare(
    `SELECT DISTINCT cs.id as series_id, cs.name as series_name, ca.granted_at
     FROM CourseAuthorization ca
     JOIN CourseSeries cs ON cs.id=ca.series_id
     WHERE ${activeAuthWhere()} AND cs.status='published'
       AND (${identityAuthWhere(identity, 'ca')})
     ORDER BY ca.granted_at DESC`
  ).all(...identityAuthValues(identity));
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
  ensureCourseIdentityColumns(db);
}

export function ensureAuthorizationAuditColumns(db: AdminDb) {
  ensureAuthorizationCommissionColumns(db);
  ensureCourseIdentityColumns(db);
  const columns = new Set((db.prepare('PRAGMA table_info(CourseAuthorization)').all() as Array<{ name: string }>).map(column => column.name));
  if (!columns.has('granted_by')) db.exec('ALTER TABLE CourseAuthorization ADD COLUMN granted_by INTEGER');
  if (!columns.has('revoked_by')) db.exec('ALTER TABLE CourseAuthorization ADD COLUMN revoked_by INTEGER');
  if (!columns.has('revoked_at')) db.exec('ALTER TABLE CourseAuthorization ADD COLUMN revoked_at DATETIME');
  if (!columns.has('order_vouchers')) db.exec("ALTER TABLE CourseAuthorization ADD COLUMN order_vouchers TEXT DEFAULT '[]'");
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_course_authorization_series_member_id
      ON CourseAuthorization(series_id, member_id, id DESC);
    CREATE INDEX IF NOT EXISTS idx_course_authorization_series_phone_id
      ON CourseAuthorization(series_id, phone, id DESC);
    CREATE INDEX IF NOT EXISTS idx_course_authorization_status_series
      ON CourseAuthorization(status, series_id, id DESC);
  `);
}

export function authorizeMembers(
  db: AdminDb,
  seriesId: number,
  memberIds: number[],
  grantedBy = 1,
  orderVouchers: AuthorizationVoucher[] = [],
  remark = '',
  financialInput: Record<string, unknown> = {},
) {
  ensureAuthorizationAuditColumns(db);
  const ids = Array.from(new Set(memberIds.filter(id => Number.isInteger(id) && id > 0)));
  if (!ids.length) return { authorized: 0 };
  const vouchers = normalizeAuthorizationVouchers(orderVouchers);
  if (!vouchers.length) throw new Error('请上传订单凭证');

  const getMember = db.prepare('SELECT id, phone, wx_openid, wx_unionid FROM Member WHERE id=?');
  const revoke = db.prepare(
    `UPDATE CourseAuthorization
     SET status='revoked', revoked_at=datetime('now','localtime'), revoked_by=?
     WHERE series_id=? AND status='active'
       AND (
         member_id=?
         OR (${normalizedPhoneSql('phone')}<>'' AND ${normalizedPhoneSql('phone')}=?)
         OR (COALESCE(wx_openid, '')<>'' AND wx_openid=?)
         OR (COALESCE(wx_unionid, '')<>'' AND wx_unionid=?)
       )`
  );
  const insert = db.prepare(
    "INSERT INTO CourseAuthorization (member_id, phone, wx_openid, wx_unionid, series_id, type, granted_by, granted_at, status, remark, order_vouchers) VALUES (?, ?, ?, ?, ?, 'admin_grant', ?, datetime('now','localtime'), 'active', ?, ?)"
  );
  const vouchersJson = JSON.stringify(vouchers);
  const financial = authorizationFinancials(db, seriesId, financialInput);

  return db.transaction(() => {
    let count = 0;
    let incomeCount = 0;
    ids.forEach(id => {
      const member = getMember.get(id) as any;
      if (!member) return;
      const normalizedPhone = normalizePhoneIdentity(member.phone);
      const wxOpenid = String(member.wx_openid || '').trim();
      const wxUnionid = String(member.wx_unionid || '').trim();
      revoke.run(grantedBy, seriesId, id, normalizedPhone, wxOpenid, wxUnionid);
      const result = insert.run(id, normalizedPhone || member.phone || '', wxOpenid, wxUnionid, seriesId, grantedBy, remark, vouchersJson);
      db.prepare('UPDATE CourseAuthorization SET actual_amount=?, sales=?, commission_rate=?, commission_amount=? WHERE id=?')
        .run(financial.amount, financial.sales, financial.rate, financial.commission, result.lastInsertRowid);
      if (recordAuthorizationIncome(db, Number(result.lastInsertRowid))) incomeCount += 1;
      createAuthorizationMessage(db, id, seriesId, result.lastInsertRowid);
      reconcileMemberAuthorizations(db, id);
      count += 1;
    });
    return { authorized: count, incomeCreated: incomeCount };
  })();
}

export function deauthorizeMembers(db: AdminDb, seriesId: number, memberIds: number[], revokedBy = 1) {
  ensureAuthorizationAuditColumns(db);
  const ids = Array.from(new Set(memberIds.filter(id => Number.isInteger(id) && id > 0)));
  if (!ids.length) return { deauthorized: 0 };

  return db.transaction(() => {
    const getMember = db.prepare('SELECT phone, wx_openid, wx_unionid FROM Member WHERE id=?');
    const revoke = db.prepare(
      `UPDATE CourseAuthorization
       SET status='revoked', revoked_at=datetime('now','localtime'), revoked_by=?
       WHERE series_id=? AND status='active'
         AND (
           member_id=?
           OR (${normalizedPhoneSql('phone')}<>'' AND ${normalizedPhoneSql('phone')}=?)
           OR (COALESCE(wx_openid, '')<>'' AND wx_openid=?)
           OR (COALESCE(wx_unionid, '')<>'' AND wx_unionid=?)
         ) RETURNING *`
    );
    let count = 0;
    ids.forEach(id => {
      const member = getMember.get(id) as { phone?: string; wx_openid?: string; wx_unionid?: string } | undefined;
      const revoked = revoke.all(
        revokedBy,
        seriesId,
        id,
        normalizePhoneIdentity(member?.phone),
        String(member?.wx_openid || '').trim(),
        String(member?.wx_unionid || '').trim(),
      );
      notifyAuthorizationRevocation(db, revoked, revokedBy);
      count += revoked.length;
      reconcileMemberAuthorizations(db, id);
    });
    return { deauthorized: count };
  })();
}

export function deauthorizeMemberIdentity(db: AdminDb, seriesId: number, memberId: number, phone = '', revokedBy = 1, authorizationId = 0) {
  ensureAuthorizationAuditColumns(db);
  if (!seriesId || (!memberId && !phone)) return { deauthorized: 0 };
  return db.transaction(() => {
    const member = memberId ? db.prepare('SELECT phone, wx_openid, wx_unionid FROM Member WHERE id=?').get<{ phone?: string; wx_openid?: string; wx_unionid?: string }>(memberId) : null;
    const authPhone = phone || member?.phone || '';
    const result = db.prepare(
      `UPDATE CourseAuthorization
       SET status='revoked', revoked_at=datetime('now','localtime'), revoked_by=?
       WHERE series_id=? AND status='active' AND (?=0 OR id=?)
         AND (
           member_id=?
           OR (${normalizedPhoneSql('phone')}<>'' AND ${normalizedPhoneSql('phone')}=?)
           OR (COALESCE(wx_openid, '')<>'' AND wx_openid=?)
           OR (COALESCE(wx_unionid, '')<>'' AND wx_unionid=?)
         ) RETURNING *`
    ).all(
      revokedBy,
      seriesId,
      authorizationId,
      authorizationId,
      memberId || 0,
      normalizePhoneIdentity(authPhone),
      String(member?.wx_openid || '').trim(),
      String(member?.wx_unionid || '').trim(),
    );
    notifyAuthorizationRevocation(db, result, revokedBy);
    if (memberId) reconcileMemberAuthorizations(db, memberId);
    return { deauthorized: result.length };
  })();
}
