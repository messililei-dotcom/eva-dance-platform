import { openAdminDb } from '@/lib/server/admin-db';
import { ensureGrowthTables } from '@/lib/server/student-growth';
import { ensureLocalAuthTables, verifyLocalToken } from './_local-auth';

export const dynamic = 'force-dynamic';

function isLocalhostRequest(request: Request) {
  if (process.env.NODE_ENV === 'production') return false;
  try {
    const hostname = new URL(request.url).hostname;
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1';
  } catch {
    return false;
  }
}

function cookieValue(cookieHeader: string | null, names: string[]) {
  if (!cookieHeader) return '';
  const cookies = cookieHeader.split(';').map(cookie => cookie.trim());
  for (const name of names) {
    const prefix = `${name}=`;
    const raw = cookies.find(cookie => cookie.startsWith(prefix))?.slice(prefix.length);
    if (!raw) continue;
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return '';
}

export function hasAuth(request: Request) {
  if (isLocalhostRequest(request)) return true;

  // 1. 检查 Authorization: Bearer header
  const bearerToken = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (bearerToken) {
    try {
      return Boolean(verifyLocalToken(bearerToken));
    } catch {}
  }

  // 2. 检查 Cookie 中的 token（用于浏览器 <video>/<img> 等媒体元素预览）
  const cookieToken = cookieValue(request.headers.get('cookie'), ['token', 'admin_media_token']);
  if (cookieToken) {
    try {
      return Boolean(verifyLocalToken(cookieToken));
    } catch {}
  }

  return false;
}

export function authPayloadFromRequest(request: Request) {
  if (isLocalhostRequest(request)) return null;

  const bearerToken = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (bearerToken) {
    try {
      const payload = verifyLocalToken(bearerToken);
      if (payload) return payload;
    } catch {}
  }

  const cookieToken = cookieValue(request.headers.get('cookie'), ['token', 'admin_media_token']);
  if (cookieToken) {
    try {
      const payload = verifyLocalToken(cookieToken);
      if (payload) return payload;
    } catch {}
  }

  return null;
}

export function unauthorized() {
  return Response.json({ success: false, error: '未登录' }, { status: 401 });
}

export function forbidden(message = '无权限访问此功能') {
  return Response.json({ success: false, error: message }, { status: 403 });
}

export function hasPermission(request: Request, permission: string) {
  if (isLocalhostRequest(request)) return true;
  if (!/^[A-Za-z0-9_]+$/.test(permission)) return false;

  const payload = authPayloadFromRequest(request);
  if (!payload?.username) return false;
  if (payload.username === 'lilei') return true;

  const db = openAdminDb();
  try {
    ensureLocalAuthTables(db);
    const row = db.prepare(
      `SELECT username, status, ${permission} as allowed FROM User WHERE username = ? OR id = ? LIMIT 1`
    ).get(payload.username, payload.id || 0) as { username?: string; status?: string; allowed?: number } | undefined;
    if (!row || row.status !== 'active') return false;
    if (row.username === 'lilei') return true;
    return Boolean(row.allowed);
  } catch {
    return false;
  } finally {
    db.close();
  }
}

export function requirePermission(request: Request, permission: string, message?: string) {
  if (!hasAuth(request)) return unauthorized();
  if (!hasPermission(request, permission)) return forbidden(message);
  return null;
}

export function requireSuperAdmin(request: Request, message = '仅超级管理员可操作') {
  if (isLocalhostRequest(request)) return null;
  if (!hasAuth(request)) return unauthorized();

  const payload = authPayloadFromRequest(request);
  if (!payload?.username) return forbidden(message);
  if (payload.username === 'lilei') return null;

  const db = openAdminDb();
  try {
    ensureLocalAuthTables(db);
    const user = db.prepare('SELECT username, role, status FROM User WHERE username = ? OR id = ? LIMIT 1')
      .get(payload.username, payload.id || 0) as { username?: string; role?: string; status?: string } | undefined;
    if (!user || user.status !== 'active') return forbidden(message);
    if (user.username === 'lilei' || user.role === 'admin') return null;
    return forbidden(message);
  } catch {
    return forbidden(message);
  } finally {
    db.close();
  }
}

export function isSuperAdminRequest(request: Request) {
  if (isLocalhostRequest(request)) return true;
  const payload = authPayloadFromRequest(request);
  if (!payload?.username) return false;
  if (payload.username === 'lilei') return true;

  const db = openAdminDb();
  try {
    ensureLocalAuthTables(db);
    const user = db.prepare('SELECT username, role, status FROM User WHERE username = ? OR id = ? LIMIT 1')
      .get(payload.username, payload.id || 0) as { username?: string; role?: string; status?: string } | undefined;
    return Boolean(user && user.status === 'active' && (user.username === 'lilei' || user.role === 'admin'));
  } catch {
    return false;
  } finally {
    db.close();
  }
}

function permissionByAction(action: unknown) {
  const normalized = cleanText(action, 'view').toLowerCase();
  if (['create', 'add', 'post', 'upload', 'new'].includes(normalized)) return 'permCourseCreate';
  if (['edit', 'update', 'put', 'patch', 'move', 'reorder', 'status', 'replace'].includes(normalized)) return 'permCourseEdit';
  if (['delete', 'remove', 'destroy'].includes(normalized)) return 'permCourseDelete';
  return 'permCourseView';
}

export function requireOnlineCoursePermission(request: Request, action: unknown = 'view', message?: string) {
  return requirePermission(request, permissionByAction(action), message);
}

export function requireMaterialPermission(request: Request, action: unknown = 'view', message?: string) {
  return requirePermission(request, permissionByAction(action), message);
}

export function requireEcommercePermission(request: Request, _action: unknown = 'view') {
  if (!hasAuth(request)) return unauthorized();
  return null;
}

export function jsonError(message: unknown, status = 500, fallback = '操作失败') {
  const safeMessage = safeErrorMessage(message, fallback, status);
  return Response.json({ success: false, error: safeMessage, message: safeMessage }, { status });
}

export function safeErrorMessage(message: unknown, fallback = '操作失败', status = 500) {
  const text = String(message || '').trim() || fallback;
  if (process.env.NODE_ENV !== 'production') return text;
  if (text !== fallback) return fallback;
  if (status >= 500 || isSensitiveErrorMessage(text)) return fallback;
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

export function openTrainingDb() {
  const db = openAdminDb();
  ensureTrainingTables(db);
  ensureGrowthTables(db);
  return db;
}

function ensureColumn(db: any, table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map((row: any) => row.name);
  if (!columns.includes(column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

export function ensureTrainingTables(db: any) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS Course (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      price INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS CourseTemplate (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE,
      type TEXT NOT NULL DEFAULT 'offline',
      trainingType TEXT DEFAULT '集训',
      coverImage TEXT DEFAULT '',
      content TEXT DEFAULT '',
      isActive INTEGER DEFAULT 1,
      websiteVisible INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS Member (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      gender TEXT DEFAULT '女',
      birthday TEXT DEFAULT '',
      level TEXT DEFAULT '普通学员',
      remark TEXT DEFAULT '',
      register_date TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS Payment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      memberId INTEGER NOT NULL,
      memberName TEXT NOT NULL,
      memberPhone TEXT DEFAULT '',
      courseId INTEGER NOT NULL,
      courseName TEXT NOT NULL,
      amount INTEGER NOT NULL DEFAULT 0,
      date TEXT NOT NULL,
      payment TEXT DEFAULT '微信',
      sales TEXT DEFAULT '',
      remark TEXT DEFAULT '',
      expireDate TEXT DEFAULT '',
      remainingSessions INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS ConsumeRecord (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      memberId INTEGER NOT NULL,
      memberName TEXT NOT NULL,
      courseId INTEGER NOT NULL,
      courseName TEXT NOT NULL,
      count INTEGER DEFAULT 1,
      consumeDate TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_no TEXT NOT NULL UNIQUE,
      member_id INTEGER DEFAULT 0,
      member_name TEXT DEFAULT '',
      member_phone TEXT DEFAULT '',
      order_type TEXT NOT NULL,
      source_type TEXT DEFAULT '',
      source_id TEXT DEFAULT '',
      title TEXT DEFAULT '',
      amount REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      pay_method TEXT DEFAULT '',
      paid_at DATETIME DEFAULT NULL,
      remark TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS CommissionSettlement (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      periodType TEXT NOT NULL DEFAULT 'month',
      period TEXT NOT NULL,
      advisor TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'unsettled',
      settledAt TEXT DEFAULT '',
      settledBy TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(periodType, period, advisor)
    );
  `);

  [
    ['Course', 'startDate', "TEXT DEFAULT ''"],
    ['Course', 'endDate', "TEXT DEFAULT ''"],
    ['Course', 'sessions', 'INTEGER DEFAULT 10'],
    ['Course', 'validDays', "TEXT DEFAULT ''"],
    ['Course', 'teacher', "TEXT DEFAULT ''"],
    ['Course', 'content', "TEXT DEFAULT ''"],
    ['Course', 'subType', "TEXT DEFAULT ''"],
    ['Course', 'attendanceSheetPath', "TEXT DEFAULT ''"],
    ['Course', 'attendanceSheetFilename', "TEXT DEFAULT ''"],
    ['Course', 'attendanceSheetUploadedAt', "TEXT DEFAULT ''"],
    ['Course', 'coverImage', "TEXT DEFAULT ''"],
    ['Course', 'series_id', 'INTEGER DEFAULT 0'],
    ['Course', 'templateId', 'INTEGER DEFAULT 0'],
    ['CourseTemplate', 'slug', "TEXT DEFAULT ''"],
    ['CourseTemplate', 'type', "TEXT DEFAULT '集训'"],
    ['CourseTemplate', 'trainingType', "TEXT DEFAULT ''"],
    ['CourseTemplate', 'coverImage', "TEXT DEFAULT ''"],
    ['CourseTemplate', 'content', "TEXT DEFAULT ''"],
    ['CourseTemplate', 'isActive', 'INTEGER DEFAULT 1'],
    ['CourseTemplate', 'websiteVisible', 'INTEGER DEFAULT 1'],
    ['CourseTemplate', 'updated_at', "DATETIME DEFAULT ''"],
    ['Member', 'province', "TEXT DEFAULT ''"],
    ['Member', 'city', "TEXT DEFAULT ''"],
    ['Member', 'address', "TEXT DEFAULT ''"],
    ['Member', 'country', "TEXT DEFAULT '中国'"],
    ['Member', 'foreignRegion', "TEXT DEFAULT ''"],
    ['Member', 'status', "TEXT DEFAULT 'active'"],
    ['Member', 'avatar', "TEXT DEFAULT ''"],
    ['Member', 'phone_country_code', "TEXT DEFAULT ''"],
    ['Member', 'phone_national_number', "TEXT DEFAULT ''"],
    ['Member', 'merged_to_member_id', 'INTEGER DEFAULT 0'],
    ['Payment', 'memberPhone', "TEXT DEFAULT ''"],
    ['Payment', 'channel', "TEXT DEFAULT 'management'"],
    ['Payment', 'paymentStatus', "TEXT DEFAULT 'paid'"],
    ['Payment', 'voucherPath', "TEXT DEFAULT ''"],
    ['Payment', 'voucherFilename', "TEXT DEFAULT ''"],
    ['Payment', 'voucherUploadedAt', "TEXT DEFAULT ''"],
    ['Payment', 'commissionRate', 'REAL DEFAULT 0'],
    ['Payment', 'commissionAmount', 'REAL DEFAULT 0'],
    ['ConsumeRecord', 'memberPhone', "TEXT DEFAULT ''"],
    ['ConsumeRecord', 'paymentId', 'INTEGER'],
    ['ConsumeRecord', 'remainingAfter', 'INTEGER'],
    ['ConsumeRecord', 'operator', "TEXT DEFAULT ''"],
    ['ConsumeRecord', 'remark', "TEXT DEFAULT ''"],
  ].forEach(([table, column, definition]) => ensureColumn(db, table, column, definition));

  db.exec(`
    INSERT INTO CourseTemplate (name, slug, type, trainingType, coverImage, content)
    SELECT TRIM(c.name), 'legacy-offline-course-' || MIN(c.id),
           'offline', COALESCE(NULLIF(TRIM(c.type), ''), '集训'),
           MAX(COALESCE(c.coverImage, '')), MAX(COALESCE(c.content, ''))
    FROM Course c
    WHERE COALESCE(c.series_id, 0) <= 0
      AND COALESCE(TRIM(c.name), '') <> ''
      AND NOT EXISTS (
        SELECT 1 FROM CourseTemplate template
        WHERE LOWER(TRIM(template.name)) = LOWER(TRIM(c.name))
          AND (LOWER(COALESCE(template.type, '')) = 'offline' OR COALESCE(template.trainingType, '') <> '')
      )
    GROUP BY LOWER(TRIM(c.name)), LOWER(TRIM(COALESCE(NULLIF(c.type, ''), '集训')));
    UPDATE Course
    SET templateId = COALESCE((
      SELECT template.id FROM CourseTemplate template
      WHERE LOWER(TRIM(template.name)) = LOWER(TRIM(Course.name))
        AND (LOWER(COALESCE(template.type, '')) = 'offline' OR COALESCE(template.trainingType, '') <> '')
      ORDER BY template.id ASC LIMIT 1
    ), 0)
    WHERE COALESCE(templateId, 0) = 0 AND COALESCE(series_id, 0) <= 0;
    UPDATE CourseTemplate
    SET trainingType = COALESCE(NULLIF(trainingType, ''), (
          SELECT COALESCE(NULLIF(c.type, ''), '集训') FROM Course c
          WHERE c.templateId = CourseTemplate.id ORDER BY c.id ASC LIMIT 1
        ), '集训'),
        coverImage = COALESCE(NULLIF(coverImage, ''), (
          SELECT NULLIF(c.coverImage, '') FROM Course c
          WHERE c.templateId = CourseTemplate.id AND COALESCE(c.coverImage, '') <> ''
          ORDER BY c.id DESC LIMIT 1
        ), ''),
        content = COALESCE(NULLIF(content, ''), (
          SELECT NULLIF(c.content, '') FROM Course c
          WHERE c.templateId = CourseTemplate.id AND COALESCE(c.content, '') <> ''
          ORDER BY c.id DESC LIMIT 1
        ), '')
    WHERE EXISTS (SELECT 1 FROM Course c WHERE c.templateId = CourseTemplate.id);
    CREATE INDEX IF NOT EXISTS idx_course_template_name_type
      ON CourseTemplate(name COLLATE NOCASE, type COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS idx_course_template_id
      ON Course(templateId);
    CREATE INDEX IF NOT EXISTS idx_member_status_created
      ON Member(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_member_name_nocase
      ON Member(name COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS idx_member_phone
      ON Member(phone);
    CREATE INDEX IF NOT EXISTS idx_payment_member_date
      ON Payment(memberId, date DESC);
    CREATE INDEX IF NOT EXISTS idx_payment_course_member
      ON Payment(courseId, memberId);
    CREATE INDEX IF NOT EXISTS idx_consume_member_date
      ON ConsumeRecord(memberId, consumeDate DESC);
    CREATE INDEX IF NOT EXISTS idx_consume_course_date
      ON ConsumeRecord(courseId, consumeDate DESC);
    CREATE INDEX IF NOT EXISTS idx_orders_effective_date
      ON orders(COALESCE(NULLIF(paid_at, ''), created_at) DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_orders_status_effective_date
      ON orders(status, COALESCE(NULLIF(paid_at, ''), created_at) DESC);
    CREATE INDEX IF NOT EXISTS idx_orders_type_effective_date
      ON orders(order_type, COALESCE(NULLIF(paid_at, ''), created_at) DESC);
    CREATE INDEX IF NOT EXISTS idx_orders_member_effective_date
      ON orders(member_id, COALESCE(NULLIF(paid_at, ''), created_at) DESC);
    CREATE INDEX IF NOT EXISTS idx_orders_source
      ON orders(source_type, source_id);
  `);
}

export function cleanText(value: unknown, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

export function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function nowIso() {
  return new Date().toISOString();
}

export function commissionAdvisorKey(value: unknown) {
  return cleanText(value, '未填写顾问');
}

export function commissionMonthKey(value: unknown) {
  const text = cleanText(value);
  return /^\d{4}-\d{2}/.test(text) ? text.slice(0, 7) : '未标记';
}

export function isCommissionSettlementLocked(db: any, advisor: unknown, period: unknown) {
  const advisorKey = commissionAdvisorKey(advisor);
  const periodKey = commissionMonthKey(period);
  const row = db.prepare(`
    SELECT status
    FROM CommissionSettlement
    WHERE periodType = 'month' AND period = ? AND advisor = ?
    LIMIT 1
  `).get(periodKey, advisorKey) as { status?: string } | undefined;
  return row?.status === 'settled';
}

export function syncPaymentOrder(db: any, paymentId: number | string) {
  const payment = db.prepare('SELECT * FROM Payment WHERE id = ?').get(paymentId);
  if (!payment) return;

  const orderNo = `线下课-${payment.id}`;
  const sourceId = String(payment.id);
  const existing = db.prepare("SELECT id FROM orders WHERE source_type = 'offline-training' AND source_id = ?").get(sourceId);
  const values = [
    orderNo,
    payment.memberId || 0,
    payment.memberName || '',
    payment.memberPhone || '',
    'training',
    'offline-training',
    sourceId,
    payment.courseName || '',
    toNumber(payment.amount),
    payment.paymentStatus || 'paid',
    payment.payment || '',
    payment.date || null,
    payment.remark || '',
    nowIso(),
  ];

  if (existing) {
    db.prepare(`
      UPDATE orders
      SET order_no = ?, member_id = ?, member_name = ?, member_phone = ?, order_type = ?,
          source_type = ?, source_id = ?, title = ?, amount = ?, status = ?,
          pay_method = ?, paid_at = ?, remark = ?, updated_at = ?
      WHERE id = ?
    `).run(...values, existing.id);
  } else {
    db.prepare(`
      INSERT INTO orders (
        order_no, member_id, member_name, member_phone, order_type, source_type,
        source_id, title, amount, status, pay_method, paid_at, remark, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(...values);
  }
}

export function deletePaymentOrder(db: any, paymentId: number | string) {
  db.prepare("DELETE FROM orders WHERE source_type = 'offline-training' AND source_id = ?").run(String(paymentId));
}

export function syncCourseDenormalizedFields(db: any, courseId: number | string) {
  const course = db.prepare('SELECT id, name FROM Course WHERE id = ?').get(courseId);
  if (!course) return;
  db.prepare('UPDATE Payment SET courseName = ? WHERE courseId = ?').run(course.name, course.id);
  db.prepare('UPDATE ConsumeRecord SET courseName = ? WHERE courseId = ?').run(course.name, course.id);
  db.prepare("UPDATE orders SET title = ?, updated_at = ? WHERE source_type = 'offline-training' AND source_id IN (SELECT CAST(id AS TEXT) FROM Payment WHERE courseId = ?)").run(course.name, nowIso(), course.id);
}

function courseIdentityKey(name: unknown, subType: unknown) {
  const normalize = (value: unknown) => cleanText(value).replace(/\s+/g, ' ').toLowerCase();
  return `${normalize(name)}\u0000${normalize(subType)}`;
}

export function findMatchingCourseByIdentity(db: any, name: unknown, subType: unknown, excludeId?: number | string) {
  const key = courseIdentityKey(name, subType);
  if (!key.split('\u0000')[0]) return null;
  return db.prepare('SELECT id, name, subType FROM Course ORDER BY id ASC').all()
    .find((course: any) => String(course.id) !== String(excludeId || '') && courseIdentityKey(course.name, course.subType) === key) || null;
}

function quoteIdentifier(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

export function ensureCoursePeriod(db: any, courseId: number | string, subType: unknown) {
  const id = toNumber(courseId);
  if (!id) return null;

  const course = db.prepare('SELECT * FROM Course WHERE id = ?').get(id) as any;
  if (!course) return null;

  const period = cleanText(subType);
  if (!period || courseIdentityKey(course.name, course.subType) === courseIdentityKey(course.name, period)) {
    return course;
  }

  const existing = findMatchingCourseByIdentity(db, course.name, period);
  if (existing?.id) {
    return db.prepare('SELECT * FROM Course WHERE id = ?').get(existing.id);
  }

  const columns = db.prepare('PRAGMA table_info(Course)').all()
    .map((row: any) => String(row.name))
    .filter((column: string) => column && column !== 'id');
  if (!columns.includes('subType')) return course;

  const now = nowIso();
  const values = columns.map((column: string) => {
    if (column === 'subType') return period;
    if (['created_at', 'createdAt', 'updated_at', 'updatedAt'].includes(column)) return now;
    return course[column];
  });
  const placeholders = columns.map(() => '?').join(', ');
  const insert = db.prepare(`INSERT INTO Course (${columns.map(quoteIdentifier).join(', ')}) VALUES (${placeholders})`);
  const result = insert.run(...values);
  return db.prepare('SELECT * FROM Course WHERE id = ?').get(result.lastInsertRowid);
}

function tableExists(db: any, tableName: string) {
  return Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(tableName));
}

function offlineCertificateSeriesId(courseId: number | string) {
  return -Math.abs(Number(courseId || 0));
}

export function mergeCourseInto(db: any, sourceCourseId: number | string, targetCourseId: number | string) {
  const source = db.prepare('SELECT * FROM Course WHERE id = ?').get(sourceCourseId);
  const target = db.prepare('SELECT * FROM Course WHERE id = ?').get(targetCourseId);
  if (!source || !target || String(source.id) === String(target.id)) return { merged: false };

  db.prepare('UPDATE Payment SET courseId = ?, courseName = ? WHERE courseId = ?').run(target.id, target.name, source.id);
  db.prepare('UPDATE ConsumeRecord SET courseId = ?, courseName = ? WHERE courseId = ?').run(target.id, target.name, source.id);

  if (tableExists(db, 'Certificate')) {
    db.prepare("UPDATE Certificate SET series_id = ?, updated_at = datetime('now','localtime') WHERE series_id = ?")
      .run(offlineCertificateSeriesId(target.id), offlineCertificateSeriesId(source.id));
  }

  if (tableExists(db, 'CertificateTemplate')) {
    const sourceSeriesId = offlineCertificateSeriesId(source.id);
    const targetSeriesId = offlineCertificateSeriesId(target.id);
    const targetTemplate = db.prepare('SELECT id FROM CertificateTemplate WHERE series_id = ?').get(targetSeriesId);
    if (targetTemplate) {
      db.prepare('DELETE FROM CertificateTemplate WHERE series_id = ?').run(sourceSeriesId);
    } else {
      db.prepare("UPDATE CertificateTemplate SET series_id = ?, updated_at = datetime('now','localtime') WHERE series_id = ?").run(targetSeriesId, sourceSeriesId);
    }
  }

  db.prepare('DELETE FROM Course WHERE id = ?').run(source.id);
  syncCourseDenormalizedFields(db, target.id);
  return { merged: true, sourceId: Number(source.id), targetId: Number(target.id) };
}

export function syncMemberDenormalizedFields(db: any, memberId: number | string) {
  const member = db.prepare('SELECT id, name, phone FROM Member WHERE id = ?').get(memberId);
  if (!member) return;
  db.prepare('UPDATE Payment SET memberName = ?, memberPhone = ? WHERE memberId = ?').run(member.name, member.phone || '', member.id);
  db.prepare('UPDATE ConsumeRecord SET memberName = ?, memberPhone = ? WHERE memberId = ?').run(member.name, member.phone || '', member.id);
  db.prepare("UPDATE orders SET member_name = ?, member_phone = ?, updated_at = ? WHERE source_type = 'offline-training' AND member_id = ?").run(member.name, member.phone || '', nowIso(), member.id);
}
