import crypto from 'crypto';
import type { AdminDb } from './admin-db';

type Row = Record<string, any>;

export const OFFLINE_LESSON_RULE = '线下课程按期次购买课时，再按实际到课核销；无需预约。';
function rejectRetiredScheduling(): void {
  throw businessError('约课及预约签到功能已取消，请购买课程期次课时后使用课时核销', 410);
}

function columns(db: AdminDb, table: string) {
  return db.prepare(`PRAGMA table_info('${table.replace(/'/g, "''")}')`).all<{ name: string }>().map(row => row.name);
}

function ensureColumn(db: AdminDb, table: string, name: string, definition: string) {
  if (!columns(db, table).includes(name)) db.prepare(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`).run();
}

export function shanghaiNowText(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

export function cleanOfflineText(value: unknown, fallback = '') {
  const text = String(value ?? '').normalize('NFC').trim();
  return text || fallback;
}

function positiveInt(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function businessError(message: string, status = 400) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

export function ensureOfflineTrainingTables(db: AdminDb) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS OfflineEnrollment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      enrollment_no TEXT NOT NULL UNIQUE,
      member_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      order_id INTEGER DEFAULT 0,
      payment_id INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending_payment',
      channel TEXT DEFAULT 'management',
      amount REAL NOT NULL DEFAULT 0,
      enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      activated_at DATETIME DEFAULT NULL,
      remark TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS OfflineEntitlement (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      enrollment_id INTEGER NOT NULL,
      payment_id INTEGER DEFAULT 0,
      total_sessions INTEGER NOT NULL DEFAULT 0,
      available_sessions INTEGER NOT NULL DEFAULT 0 CHECK(available_sessions >= 0),
      frozen_sessions INTEGER NOT NULL DEFAULT 0 CHECK(frozen_sessions >= 0),
      used_sessions INTEGER NOT NULL DEFAULT 0 CHECK(used_sessions >= 0),
      expired_sessions INTEGER NOT NULL DEFAULT 0 CHECK(expired_sessions >= 0),
      valid_from TEXT DEFAULT '',
      valid_until TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      version INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS OfflineSession (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      session_no INTEGER NOT NULL,
      session_date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      teacher_name TEXT DEFAULT '',
      classroom TEXT DEFAULT '',
      address TEXT DEFAULT '',
      capacity INTEGER NOT NULL DEFAULT 30 CHECK(capacity > 0),
      booked_count INTEGER NOT NULL DEFAULT 0 CHECK(booked_count >= 0),
      consume_count INTEGER NOT NULL DEFAULT 1 CHECK(consume_count = 1),
      booking_open_at TEXT DEFAULT '',
      booking_close_at TEXT DEFAULT '',
      cancel_deadline_at TEXT DEFAULT '',
      checkin_open_at TEXT DEFAULT '',
      checkin_close_at TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      version INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(course_id, session_date, start_time)
    );
    CREATE TABLE IF NOT EXISTS OfflineBooking (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_no TEXT NOT NULL UNIQUE,
      member_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      session_id INTEGER NOT NULL,
      entitlement_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'booked',
      source TEXT DEFAULT 'mini',
      reserved_count INTEGER NOT NULL DEFAULT 1 CHECK(reserved_count = 1),
      booked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      cancelled_at DATETIME DEFAULT NULL,
      cancel_reason TEXT DEFAULT '',
      checked_in_at DATETIME DEFAULT NULL,
      consumed_at DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(member_id, session_id)
    );
    CREATE TABLE IF NOT EXISTS OfflineAttendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL UNIQUE,
      member_id INTEGER NOT NULL,
      session_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'checked_in',
      checkin_method TEXT DEFAULT 'qr',
      operator_name TEXT DEFAULT '',
      checked_in_at DATETIME NOT NULL,
      consume_record_id INTEGER DEFAULT 0,
      remark TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS OfflineCheckinToken (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      valid_from DATETIME NOT NULL,
      valid_until DATETIME NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_by TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_offline_enrollment_payment
      ON OfflineEnrollment(payment_id) WHERE payment_id > 0;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_offline_entitlement_payment
      ON OfflineEntitlement(payment_id) WHERE payment_id > 0;
    CREATE INDEX IF NOT EXISTS idx_offline_entitlement_member_course
      ON OfflineEntitlement(member_id, course_id, status, valid_until);
    CREATE INDEX IF NOT EXISTS idx_offline_session_date
      ON OfflineSession(session_date, start_time, status);
    CREATE INDEX IF NOT EXISTS idx_offline_booking_session_status
      ON OfflineBooking(session_id, status);
    CREATE INDEX IF NOT EXISTS idx_offline_booking_member_status
      ON OfflineBooking(member_id, status, booked_at);
    CREATE INDEX IF NOT EXISTS idx_offline_token_session
      ON OfflineCheckinToken(session_id, status, valid_until);
  `);

  ensureColumn(db, 'ConsumeRecord', 'sessionId', 'INTEGER DEFAULT 0');
  ensureColumn(db, 'ConsumeRecord', 'bookingId', 'INTEGER DEFAULT 0');
  ensureColumn(db, 'ConsumeRecord', 'attendanceId', 'INTEGER DEFAULT 0');
  ensureColumn(db, 'ConsumeRecord', 'idempotencyKey', "TEXT DEFAULT ''");
  ensureColumn(db, 'ConsumeRecord', 'source', "TEXT DEFAULT 'manual'");
  ensureColumn(db, 'ConsumeRecord', 'reversalOf', 'INTEGER DEFAULT 0');
  ensureColumn(db, 'ConsumeRecord', 'status', "TEXT DEFAULT 'active'");
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_consume_idempotency ON ConsumeRecord(idempotencyKey) WHERE idempotencyKey <> ''");
}

export function backfillOfflineEntitlements(db: AdminDb) {
  ensureOfflineTrainingTables(db);
  const payments = db.prepare('SELECT * FROM Payment ORDER BY id').all<Row>();
  let createdEnrollments = 0;
  let createdEntitlements = 0;

  db.transaction(() => {
    for (const payment of payments) {
      let enrollment = db.prepare('SELECT * FROM OfflineEnrollment WHERE payment_id=?').get<Row>(payment.id);
      if (!enrollment) {
        const active = ['paid', 'completed'].includes(String(payment.paymentStatus || ''));
        const result = db.prepare(`
          INSERT INTO OfflineEnrollment (
            enrollment_no, member_id, course_id, payment_id, status, channel,
            amount, enrolled_at, activated_at, remark
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          `BM-${String(payment.id).padStart(8, '0')}`,
          payment.memberId,
          payment.courseId,
          payment.id,
          active ? 'active' : 'pending_payment',
          payment.channel || 'management',
          Number(payment.amount || 0),
          payment.date || payment.created_at || shanghaiNowText(),
          active ? (payment.date || payment.created_at || shanghaiNowText()) : null,
          payment.remark || '',
        );
        enrollment = db.prepare('SELECT * FROM OfflineEnrollment WHERE id=?').get<Row>(result.lastInsertRowid);
        createdEnrollments += 1;
      }

      if (!db.prepare('SELECT id FROM OfflineEntitlement WHERE payment_id=?').get(payment.id)) {
        const used = Number(db.prepare(
          "SELECT COALESCE(SUM(count),0) AS count FROM ConsumeRecord WHERE paymentId=? AND COALESCE(status,'active')='active'"
        ).get<{ count: number }>(payment.id)?.count || 0);
        const active = ['paid', 'completed'].includes(String(payment.paymentStatus || ''));
        const available = active ? Math.max(0, Number(payment.remainingSessions || 0)) : 0;
        db.prepare(`
          INSERT INTO OfflineEntitlement (
            member_id, course_id, enrollment_id, payment_id, total_sessions,
            available_sessions, frozen_sessions, used_sessions, valid_from,
            valid_until, status
          ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
        `).run(
          payment.memberId,
          payment.courseId,
          enrollment!.id,
          payment.id,
          available + used,
          available,
          used,
          payment.date || '',
          payment.expireDate || '',
          active ? 'active' : 'pending',
        );
        createdEntitlements += 1;
      } else {
        // Payment is the authoritative balance; reservations remain frozen separately.
        const entitlement = db.prepare('SELECT * FROM OfflineEntitlement WHERE payment_id=?').get<Row>(payment.id)!;
        const active = ['paid', 'completed'].includes(String(payment.paymentStatus || ''));
        const used = Number(db.prepare("SELECT COALESCE(SUM(count),0) AS count FROM ConsumeRecord WHERE paymentId=? AND COALESCE(status,'active')='active'").get<{ count: number }>(payment.id)?.count || 0);
        const frozen = Number(entitlement.frozen_sessions || 0);
        const available = active ? Math.max(0, Number(payment.remainingSessions || 0) - frozen) : 0;
        const validFrom = payment.date || '';
        const validUntil = payment.expireDate || '';
        const status = active ? 'active' : 'pending';
        if (entitlement.available_sessions !== available || entitlement.used_sessions !== used || entitlement.status !== status || entitlement.valid_from !== validFrom || entitlement.valid_until !== validUntil) {
          db.prepare(`UPDATE OfflineEntitlement SET total_sessions=?, available_sessions=?, used_sessions=?,
            valid_from=?, valid_until=?, status=?, version=version+1, updated_at=? WHERE id=?`)
            .run(available + frozen + used, available, used, validFrom, validUntil, status, shanghaiNowText(), entitlement.id);
        }
      }
      const enrollmentStatus = ['paid', 'completed'].includes(String(payment.paymentStatus || '')) ? 'active' : 'pending_payment';
      if (enrollment!.status !== enrollmentStatus) db.prepare('UPDATE OfflineEnrollment SET status=?, updated_at=? WHERE id=?').run(enrollmentStatus, shanghaiNowText(), enrollment!.id);
    }
  })();

  return {
    payments: payments.length,
    createdEnrollments,
    createdEntitlements,
    totals: db.prepare(`
      SELECT COUNT(*) AS entitlementCount,
             COALESCE(SUM(available_sessions),0) AS availableSessions,
             COALESCE(SUM(frozen_sessions),0) AS frozenSessions,
             COALESCE(SUM(used_sessions),0) AS usedSessions
      FROM OfflineEntitlement
      WHERE status='active'
    `).get(),
  };
}

export function listOfflineSessions(db: AdminDb, filters: { courseId?: unknown; dateFrom?: string; dateTo?: string } = {}) {
  ensureOfflineTrainingTables(db);
  const conditions: string[] = ['1=1'];
  const params: unknown[] = [];
  if (positiveInt(filters.courseId)) {
    conditions.push('s.course_id=?');
    params.push(positiveInt(filters.courseId));
  }
  if (filters.dateFrom) {
    conditions.push('s.session_date>=?');
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    conditions.push('s.session_date<=?');
    params.push(filters.dateTo);
  }
  return db.prepare(`
    SELECT s.*, c.name AS course_name, c.subType AS course_period,
           (SELECT COUNT(*) FROM OfflineBooking b WHERE b.session_id=s.id AND b.status IN ('booked','checked_in','consumed')) AS actual_booked_count,
           (SELECT COUNT(*) FROM OfflineBooking b WHERE b.session_id=s.id AND b.status IN ('checked_in','consumed')) AS checked_in_count
    FROM OfflineSession s
    JOIN Course c ON c.id=s.course_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY s.session_date, s.start_time, s.id
  `).all(...params);
}

export function createOfflineSession(db: AdminDb, input: Row) {
  rejectRetiredScheduling();
  ensureOfflineTrainingTables(db);
  const courseId = positiveInt(input.courseId ?? input.course_id);
  const sessionDate = cleanOfflineText(input.sessionDate ?? input.session_date);
  const startTime = cleanOfflineText(input.startTime ?? input.start_time);
  const endTime = cleanOfflineText(input.endTime ?? input.end_time);
  if (!courseId || !sessionDate || !startTime || !endTime) throw businessError('请选择课程并填写完整上课日期和时间');
  const course = db.prepare('SELECT * FROM Course WHERE id=?').get<Row>(courseId);
  if (!course) throw businessError('课程不存在', 404);
  const sessionNo = positiveInt(input.sessionNo ?? input.session_no)
    || Number(db.prepare('SELECT COALESCE(MAX(session_no),0)+1 AS value FROM OfflineSession WHERE course_id=?').get<{ value: number }>(courseId)?.value || 1);
  const result = db.prepare(`
    INSERT INTO OfflineSession (
      course_id, session_no, session_date, start_time, end_time, teacher_name,
      classroom, address, capacity, booking_open_at, booking_close_at,
      cancel_deadline_at, checkin_open_at, checkin_close_at, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    courseId,
    sessionNo,
    sessionDate,
    startTime,
    endTime,
    cleanOfflineText(input.teacherName ?? input.teacher_name, course.teacher || ''),
    cleanOfflineText(input.classroom),
    cleanOfflineText(input.address),
    positiveInt(input.capacity, 30),
    cleanOfflineText(input.bookingOpenAt ?? input.booking_open_at),
    cleanOfflineText(input.bookingCloseAt ?? input.booking_close_at, `${sessionDate} ${startTime}`),
    cleanOfflineText(input.cancelDeadlineAt ?? input.cancel_deadline_at),
    cleanOfflineText(input.checkinOpenAt ?? input.checkin_open_at, `${sessionDate} ${startTime}`),
    cleanOfflineText(input.checkinCloseAt ?? input.checkin_close_at, `${sessionDate} ${endTime}`),
    ['draft', 'published'].includes(input.status) ? input.status : 'draft',
  );
  return db.prepare('SELECT * FROM OfflineSession WHERE id=?').get(result.lastInsertRowid);
}

export function updateOfflineSession(db: AdminDb, sessionId: unknown, input: Row) {
  rejectRetiredScheduling();
  ensureOfflineTrainingTables(db);
  const id = positiveInt(sessionId);
  const current = db.prepare('SELECT * FROM OfflineSession WHERE id=?').get<Row>(id);
  if (!current) throw businessError('课次不存在', 404);
  const sessionDate = cleanOfflineText(input.sessionDate ?? input.session_date, current.session_date);
  const startTime = cleanOfflineText(input.startTime ?? input.start_time, current.start_time);
  const endTime = cleanOfflineText(input.endTime ?? input.end_time, current.end_time);
  const status = cleanOfflineText(input.status, current.status);
  db.prepare(`
    UPDATE OfflineSession SET
      session_no=?, session_date=?, start_time=?, end_time=?, teacher_name=?,
      classroom=?, address=?, capacity=?, booking_open_at=?, booking_close_at=?,
      cancel_deadline_at=?, checkin_open_at=?, checkin_close_at=?, status=?,
      version=version+1, updated_at=?
    WHERE id=?
  `).run(
    positiveInt(input.sessionNo ?? input.session_no, current.session_no),
    sessionDate,
    startTime,
    endTime,
    cleanOfflineText(input.teacherName ?? input.teacher_name, current.teacher_name),
    cleanOfflineText(input.classroom, current.classroom),
    cleanOfflineText(input.address, current.address),
    positiveInt(input.capacity, current.capacity),
    cleanOfflineText(input.bookingOpenAt ?? input.booking_open_at, current.booking_open_at),
    cleanOfflineText(input.bookingCloseAt ?? input.booking_close_at, current.booking_close_at),
    cleanOfflineText(input.cancelDeadlineAt ?? input.cancel_deadline_at, current.cancel_deadline_at),
    cleanOfflineText(input.checkinOpenAt ?? input.checkin_open_at, current.checkin_open_at),
    cleanOfflineText(input.checkinCloseAt ?? input.checkin_close_at, current.checkin_close_at),
    status,
    shanghaiNowText(),
    id,
  );
  return db.prepare('SELECT * FROM OfflineSession WHERE id=?').get(id);
}

function activeEntitlement(db: AdminDb, memberId: number, courseId: number) {
  const today = shanghaiNowText().slice(0, 10);
  return db.prepare(`
    SELECT * FROM OfflineEntitlement
    WHERE member_id=? AND course_id=? AND status='active' AND available_sessions>0
      AND (COALESCE(valid_until,'')='' OR substr(valid_until,1,10)>=?)
      AND (COALESCE(valid_from,'')='' OR substr(valid_from,1,10)<=?)
    ORDER BY CASE WHEN COALESCE(valid_until,'')='' THEN 1 ELSE 0 END, valid_until, id
    LIMIT 1
  `).get<Row>(memberId, courseId, today, today);
}

export function createOfflineBooking(db: AdminDb, input: Row) {
  rejectRetiredScheduling();
  ensureOfflineTrainingTables(db);
  backfillOfflineEntitlements(db);
  const memberId = positiveInt(input.memberId ?? input.member_id);
  const sessionId = positiveInt(input.sessionId ?? input.session_id);
  if (!memberId || !sessionId) throw businessError('请选择学员和课次');
  const now = shanghaiNowText();

  return db.transaction(() => {
    const session = db.prepare('SELECT * FROM OfflineSession WHERE id=?').get<Row>(sessionId);
    if (!session) throw businessError('课次不存在', 404);
    if (!['published', 'checkin_open'].includes(session.status)) throw businessError('该课次尚未开放预约', 409);
    if (`${session.session_date} ${session.start_time}` <= now) throw businessError('该课次已开始或结束，不能预约', 409);
    if (session.booking_open_at && now < session.booking_open_at) throw businessError('预约尚未开始', 409);
    if (session.booking_close_at && now > session.booking_close_at) throw businessError('预约已经截止', 409);
    const previousBooking = db.prepare('SELECT * FROM OfflineBooking WHERE member_id=? AND session_id=?')
      .get<Row>(memberId, sessionId);
    if (previousBooking && previousBooking.status !== 'cancelled') throw businessError('您已预约该课次', 409);

    const entitlement = activeEntitlement(db, memberId, session.course_id);
    if (!entitlement) throw businessError('没有该课程的可用课次', 409);
    const receipt = db.prepare('SELECT paymentStatus FROM Payment WHERE id=?').get<Row>(entitlement.payment_id);
    if (!receipt || !['paid','completed'].includes(receipt.paymentStatus)) throw businessError('课程缴费正在退款或未到账，暂不能预约',409);
    const capacityUpdate = db.prepare(`
      UPDATE OfflineSession SET booked_count=booked_count+1, version=version+1, updated_at=?
      WHERE id=? AND booked_count<capacity
    `).run(now, sessionId);
    if (!capacityUpdate.changes) throw businessError('该课次已满员', 409);
    const entitlementUpdate = db.prepare(`
      UPDATE OfflineEntitlement
      SET available_sessions=available_sessions-1, frozen_sessions=frozen_sessions+1,
          version=version+1, updated_at=?
      WHERE id=? AND available_sessions>0
    `).run(now, entitlement.id);
    if (!entitlementUpdate.changes) throw businessError('可用课次不足', 409);

    if (previousBooking) {
      db.prepare(`
        UPDATE OfflineBooking
        SET entitlement_id=?, status='booked', source=?, booked_at=?, cancelled_at=NULL,
            cancel_reason='', checked_in_at=NULL, consumed_at=NULL, updated_at=?
        WHERE id=?
      `).run(entitlement.id, cleanOfflineText(input.source, 'mini'), now, now, previousBooking.id);
      return db.prepare('SELECT * FROM OfflineBooking WHERE id=?').get(previousBooking.id);
    }

    const bookingNo = `YK-${now.replace(/\D/g, '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const result = db.prepare(`
      INSERT INTO OfflineBooking (
        booking_no, member_id, course_id, session_id, entitlement_id, status, source, booked_at
      ) VALUES (?, ?, ?, ?, ?, 'booked', ?, ?)
    `).run(bookingNo, memberId, session.course_id, sessionId, entitlement.id, cleanOfflineText(input.source, 'mini'), now);
    return db.prepare('SELECT * FROM OfflineBooking WHERE id=?').get(result.lastInsertRowid);
  })();
}

export function cancelOfflineBooking(db: AdminDb, bookingId: unknown, memberId?: unknown, reason = '') {
  rejectRetiredScheduling();
  ensureOfflineTrainingTables(db);
  const id = positiveInt(bookingId);
  const now = shanghaiNowText();
  return db.transaction(() => {
    const booking = db.prepare('SELECT * FROM OfflineBooking WHERE id=?').get<Row>(id);
    if (!booking) throw businessError('预约不存在', 404);
    if (positiveInt(memberId) && Number(booking.member_id) !== positiveInt(memberId)) throw businessError('无权取消该预约', 403);
    if (booking.status !== 'booked') throw businessError('当前预约状态不能取消', 409);
    const session = db.prepare('SELECT * FROM OfflineSession WHERE id=?').get<Row>(booking.session_id);
    if (positiveInt(memberId) && session?.cancel_deadline_at && now > session.cancel_deadline_at) {
      throw businessError('已超过免费取消时间，请联系管理员', 409);
    }
    db.prepare(`
      UPDATE OfflineBooking SET status='cancelled', cancelled_at=?, cancel_reason=?, updated_at=? WHERE id=?
    `).run(now, cleanOfflineText(reason), now, id);
    db.prepare(`
      UPDATE OfflineEntitlement SET available_sessions=available_sessions+1,
        frozen_sessions=frozen_sessions-1, version=version+1, updated_at=?
      WHERE id=? AND frozen_sessions>0
    `).run(now, booking.entitlement_id);
    db.prepare(`
      UPDATE OfflineSession SET booked_count=CASE WHEN booked_count>0 THEN booked_count-1 ELSE 0 END,
        version=version+1, updated_at=? WHERE id=?
    `).run(now, booking.session_id);
    return db.prepare('SELECT * FROM OfflineBooking WHERE id=?').get(id);
  })();
}

export function openOfflineCheckin(db: AdminDb, sessionId: unknown, operator = '') {
  rejectRetiredScheduling();
  ensureOfflineTrainingTables(db);
  const id = positiveInt(sessionId);
  const session = db.prepare('SELECT * FROM OfflineSession WHERE id=?').get<Row>(id);
  if (!session) throw businessError('课次不存在', 404);
  const token = crypto.randomBytes(18).toString('base64url');
  const now = shanghaiNowText();
  const validUntil = session.checkin_close_at || `${session.session_date} ${session.end_time}`;
  db.transaction(() => {
    db.prepare("UPDATE OfflineCheckinToken SET status='revoked' WHERE session_id=? AND status='active'").run(id);
    db.prepare(`
      INSERT INTO OfflineCheckinToken (session_id, token_hash, valid_from, valid_until, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, hashToken(token), now, validUntil, cleanOfflineText(operator));
    db.prepare("UPDATE OfflineSession SET status='checkin_open', updated_at=? WHERE id=?").run(now, id);
  })();
  return { sessionId: id, checkinCode: token, validFrom: now, validUntil };
}

export function checkinOfflineBooking(db: AdminDb, input: Row) {
  rejectRetiredScheduling();
  ensureOfflineTrainingTables(db);
  const bookingId = positiveInt(input.bookingId ?? input.booking_id);
  const memberId = positiveInt(input.memberId ?? input.member_id);
  const token = cleanOfflineText(input.checkinCode ?? input.checkin_code);
  const adminOverride = Boolean(input.adminOverride);
  const now = shanghaiNowText();

  return db.transaction(() => {
    const booking = db.prepare('SELECT * FROM OfflineBooking WHERE id=?').get<Row>(bookingId);
    if (!booking) throw businessError('预约不存在', 404);
    if (memberId && Number(booking.member_id) !== memberId) throw businessError('无权签到该预约', 403);
    if (['checked_in', 'consumed'].includes(booking.status)) {
      const existing = db.prepare('SELECT * FROM OfflineAttendance WHERE booking_id=?').get<Row>(booking.id);
      return { booking, attendance: existing, repeated: true };
    }
    if (booking.status !== 'booked') throw businessError('当前预约状态不能签到', 409);
    const session = db.prepare('SELECT * FROM OfflineSession WHERE id=?').get<Row>(booking.session_id);
    if (!session) throw businessError('课次不存在', 404);
    if (!adminOverride) {
      const tokenRow = token && db.prepare(`
        SELECT * FROM OfflineCheckinToken
        WHERE session_id=? AND token_hash=? AND status='active' AND valid_from<=? AND valid_until>=?
        ORDER BY id DESC LIMIT 1
      `).get<Row>(session.id, hashToken(token), now, now);
      if (!tokenRow) throw businessError('签到码无效或已过期', 409);
    }
    const entitlement = db.prepare('SELECT * FROM OfflineEntitlement WHERE id=?').get<Row>(booking.entitlement_id);
    if (!entitlement || Number(entitlement.frozen_sessions) < 1) throw businessError('预约冻结课次异常，请联系管理员', 409);
    const payment = db.prepare('SELECT * FROM Payment WHERE id=?').get<Row>(entitlement.payment_id);
    if (!payment || !['paid', 'completed'].includes(String(payment.paymentStatus || '')) || Number(payment.remainingSessions) < 1) throw businessError('剩余课次不足，无法核销', 409);
    const idempotencyKey = `offline-booking:${booking.id}`;
    const existingConsume = db.prepare('SELECT * FROM ConsumeRecord WHERE idempotencyKey=?').get<Row>(idempotencyKey);
    if (existingConsume) {
      return {
        booking: db.prepare('SELECT * FROM OfflineBooking WHERE id=?').get(booking.id),
        attendance: db.prepare('SELECT * FROM OfflineAttendance WHERE booking_id=?').get(booking.id),
        repeated: true,
      };
    }

    const remainingAfter = Number(payment.remainingSessions) - 1;
    const attendanceResult = db.prepare(`
      INSERT INTO OfflineAttendance (
        booking_id, member_id, session_id, status, checkin_method, operator_name, checked_in_at, remark
      ) VALUES (?, ?, ?, 'checked_in', ?, ?, ?, ?)
    `).run(
      booking.id,
      booking.member_id,
      booking.session_id,
      adminOverride ? 'manual' : 'qr',
      cleanOfflineText(input.operatorName ?? input.operator_name, adminOverride ? '管理员' : '学员自助签到'),
      now,
      cleanOfflineText(input.remark),
    );
    const attendanceId = Number(attendanceResult.lastInsertRowid);
    const consumeResult = db.prepare(`
      INSERT INTO ConsumeRecord (
        memberId, memberName, memberPhone, paymentId, courseId, courseName, count,
        consumeDate, remainingAfter, operator, remark, sessionId, bookingId,
        attendanceId, idempotencyKey, source, status
      ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `).run(
      payment.memberId,
      payment.memberName,
      payment.memberPhone || '',
      payment.id,
      payment.courseId,
      payment.courseName,
      now.slice(0, 10),
      remainingAfter,
      adminOverride ? cleanOfflineText(input.operatorName, '管理员') : '学员自助签到',
      cleanOfflineText(input.remark, `第${session.session_no}课次签到核销`),
      session.id,
      booking.id,
      attendanceId,
      idempotencyKey,
      adminOverride ? 'admin_checkin' : 'qr_checkin',
    );
    db.prepare('UPDATE OfflineAttendance SET consume_record_id=?, updated_at=? WHERE id=?')
      .run(consumeResult.lastInsertRowid, now, attendanceId);
    db.prepare(`
      UPDATE OfflineEntitlement SET frozen_sessions=frozen_sessions-1,
        used_sessions=used_sessions+1, version=version+1, updated_at=?
      WHERE id=? AND frozen_sessions>0
    `).run(now, entitlement.id);
    db.prepare('UPDATE Payment SET remainingSessions=? WHERE id=?').run(remainingAfter, payment.id);
    db.prepare(`
      UPDATE OfflineBooking SET status='consumed', checked_in_at=?, consumed_at=?, updated_at=? WHERE id=?
    `).run(now, now, now, booking.id);

    return {
      booking: db.prepare('SELECT * FROM OfflineBooking WHERE id=?').get(booking.id),
      attendance: db.prepare('SELECT * FROM OfflineAttendance WHERE id=?').get(attendanceId),
      remainingSessions: remainingAfter,
      repeated: false,
    };
  })();
}

export function listOfflineBookings(db: AdminDb, filters: { memberId?: unknown; sessionId?: unknown } = {}) {
  ensureOfflineTrainingTables(db);
  const conditions: string[] = ['1=1'];
  const params: unknown[] = [];
  if (positiveInt(filters.memberId)) {
    conditions.push('b.member_id=?');
    params.push(positiveInt(filters.memberId));
  }
  if (positiveInt(filters.sessionId)) {
    conditions.push('b.session_id=?');
    params.push(positiveInt(filters.sessionId));
  }
  return db.prepare(`
    SELECT b.*, m.name AS member_name, m.phone AS member_phone,
           c.name AS course_name, c.subType AS course_period,
           s.session_no, s.session_date, s.start_time, s.end_time,
           s.teacher_name, s.classroom, s.address,
           e.available_sessions, e.frozen_sessions, e.used_sessions
    FROM OfflineBooking b
    JOIN Member m ON m.id=b.member_id
    JOIN Course c ON c.id=b.course_id
    JOIN OfflineSession s ON s.id=b.session_id
    JOIN OfflineEntitlement e ON e.id=b.entitlement_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY s.session_date DESC, s.start_time DESC, b.id DESC
  `).all(...params);
}

export function memberOfflineOverview(db: AdminDb, memberId: unknown, filters: { courseIds?: number[] } = {}) {
  ensureOfflineTrainingTables(db);
  backfillOfflineEntitlements(db);
  const id = positiveInt(memberId);
  if (!id) throw businessError('未登录', 401);
  const entitlements = db.prepare(`
    SELECT e.*, c.name AS course_name, c.subType AS course_period, c.teacher,
           c.coverImage AS cover_image
    FROM OfflineEntitlement e
    JOIN Course c ON c.id=e.course_id
    JOIN Payment p ON p.id=e.payment_id AND p.paymentStatus IN ('paid','completed')
    WHERE e.member_id=? AND e.status='active'
    ORDER BY e.valid_until, e.id
  `).all(id);
  const courseIds = [...new Set((filters.courseIds || []).map(id => positiveInt(id)).filter(Boolean))].slice(0, 200);
  const consumes = db.prepare(`SELECT cr.id, cr.courseId AS course_id, cr.courseName AS course_name,
    c.subType AS course_period, cr.count, cr.consumeDate AS consume_date, cr.remainingAfter AS remaining_after
    FROM ConsumeRecord cr LEFT JOIN Course c ON c.id=cr.courseId
    WHERE cr.memberId=? AND COALESCE(cr.status,'active')='active'
      ${courseIds.length ? `AND cr.courseId IN (${courseIds.map(() => '?').join(',')})` : ''}
    ORDER BY cr.consumeDate DESC,cr.id DESC LIMIT 200`).all(id,...courseIds);
  return { entitlements: entitlements.filter((e:any) => !courseIds.length || courseIds.includes(Number(e.course_id))),
    sessions: [], bookings: [], consumes, rule: OFFLINE_LESSON_RULE, bookingEnabled: false };

}

export function offlineErrorResponse(error: unknown) {
  const err = error as Error & { status?: number };
  const message = cleanOfflineText(err?.message, '操作失败');
  return Response.json({ success: false, error: message, message }, { status: err?.status || 500 });
}

/** Mirror the authoritative paid receipt balance after a direct lesson write-off. */
export function syncOfflinePaymentBalance(db: AdminDb, paymentId: unknown) {
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE name='OfflineEntitlement'").get()) return;
  const payment=db.prepare('SELECT * FROM Payment WHERE id=?').get<Row>(positiveInt(paymentId));
  if (!payment) return;
  const used=Number(db.prepare("SELECT COALESCE(SUM(count),0) n FROM ConsumeRecord WHERE paymentId=? AND COALESCE(status,'active')='active'").get<{n:number}>(payment.id)?.n||0);
  const available=['paid','completed'].includes(String(payment.paymentStatus||''))?Math.max(0,Number(payment.remainingSessions||0)):0;
  db.prepare(`UPDATE OfflineEntitlement SET available_sessions=?,used_sessions=?,total_sessions=?,
    version=version+1,updated_at=? WHERE payment_id=?`).run(available,used,available+used,shanghaiNowText(),payment.id);
}
