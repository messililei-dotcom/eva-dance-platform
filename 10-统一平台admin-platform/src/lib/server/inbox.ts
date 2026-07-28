import type { AdminDb } from '@/lib/server/admin-db';

export type InboxType =
  | 'welcome'
  | 'growth'
  | 'level_up'
  | 'course'
  | 'offline'
  | 'consume'
  | 'certificate'
  | 'event'
  | 'system';

export type InboxPriority = 'normal' | 'important' | 'urgent';

export type CreateInboxMessageInput = {
  type: InboxType;
  title: string;
  content: string;
  actionUrl?: string;
  businessType?: string;
  businessId?: string | number;
  dedupeKey: string;
  priority?: InboxPriority;
  payload?: Record<string, unknown>;
  expiresAt?: string;
  memberIds: Array<number | string>;
};

export type GrowthEventInput = {
  memberId: number;
  eventType: string;
  points: number;
  sourceType: string;
  sourceId: string | number;
  description: string;
  occurredAt?: string;
  operatorId?: string | number;
  actionUrl?: string;
};

const LEVELS = [
  { no: 1, name: '初舞学员', min: 0 },
  { no: 2, name: '律动学员', min: 1000 },
  { no: 3, name: '舞韵学员', min: 5000 },
  { no: 4, name: '资深舞者', min: 15000 },
  { no: 5, name: '卓越舞者', min: 30000 },
] as const;

function clean(value: unknown, fallback = '') {
  const text = String(value ?? '').normalize('NFC').trim();
  return text || fallback;
}

function positiveInt(value: unknown) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : 0;
}

function nowText(date = new Date()) {
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

function dateKey(dateText = nowText()) {
  return dateText.slice(0, 10);
}

function levelForExperience(experience: number) {
  return [...LEVELS].reverse().find(level => experience >= level.min) || LEVELS[0];
}

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value || {});
  } catch {
    return '{}';
  }
}

function parseJson(value: unknown): Record<string, any> {
  try {
    const parsed = JSON.parse(String(value || '{}'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function ensureInboxSchema(db: AdminDb) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS InboxMessage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      action_url TEXT NOT NULL DEFAULT '',
      business_type TEXT NOT NULL DEFAULT '',
      business_id TEXT NOT NULL DEFAULT '',
      dedupe_key TEXT NOT NULL UNIQUE,
      priority TEXT NOT NULL DEFAULT 'normal',
      payload_json TEXT NOT NULL DEFAULT '{}',
      expires_at DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS InboxRecipient (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id INTEGER NOT NULL,
      member_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'unread',
      read_at DATETIME DEFAULT NULL,
      archived_at DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(message_id, member_id)
    );
    CREATE TABLE IF NOT EXISTS CourseContentRelease (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      series_id INTEGER NOT NULL,
      release_no INTEGER NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      lesson_count INTEGER NOT NULL DEFAULT 0,
      published_by TEXT NOT NULL DEFAULT '',
      published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(series_id, release_no)
    );
    CREATE TABLE IF NOT EXISTS InboxJobRun (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_type TEXT NOT NULL,
      run_key TEXT NOT NULL UNIQUE,
      created_count INTEGER NOT NULL DEFAULT 0,
      detail TEXT NOT NULL DEFAULT '',
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      finished_at DATETIME DEFAULT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_inbox_recipient_member_status_created
      ON InboxRecipient(member_id, status, created_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_inbox_recipient_message
      ON InboxRecipient(message_id, member_id);
    CREATE INDEX IF NOT EXISTS idx_inbox_message_type_created
      ON InboxMessage(type, created_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_course_content_release_series
      ON CourseContentRelease(series_id, release_no DESC);
  `);
}

export function createInboxMessage(db: AdminDb, input: CreateInboxMessageInput) {
  ensureInboxSchema(db);
  const memberIds = Array.from(new Set(input.memberIds.map(positiveInt).filter(Boolean)));
  if (!memberIds.length || !clean(input.dedupeKey)) return { messageId: 0, recipients: 0, created: false };

  const existing = db.prepare('SELECT id FROM InboxMessage WHERE dedupe_key=?')
    .get<{ id: number }>(input.dedupeKey);
  let messageId = Number(existing?.id || 0);
  let created = false;

  if (!messageId) {
    const result = db.prepare(`
      INSERT INTO InboxMessage (
        type, title, content, action_url, business_type, business_id,
        dedupe_key, priority, payload_json, expires_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'), datetime('now','localtime'))
    `).run(
      input.type,
      clean(input.title, '新消息'),
      clean(input.content),
      clean(input.actionUrl),
      clean(input.businessType),
      clean(input.businessId),
      clean(input.dedupeKey),
      input.priority || 'normal',
      safeJson(input.payload),
      clean(input.expiresAt) || null,
    );
    messageId = Number(result.lastInsertRowid);
    created = true;
  }

  const insertRecipient = db.prepare(`
    INSERT OR IGNORE INTO InboxRecipient (message_id, member_id, status, created_at)
    VALUES (?, ?, 'unread', datetime('now','localtime'))
  `);
  let recipients = 0;
  memberIds.forEach(memberId => {
    recipients += Number(insertRecipient.run(messageId, memberId).changes || 0);
  });
  return { messageId, recipients, created };
}

export function createPersonalMessage(
  db: AdminDb,
  memberId: number,
  input: Omit<CreateInboxMessageInput, 'memberIds'>,
) {
  return createInboxMessage(db, { ...input, memberIds: [memberId] });
}

export function createWelcomeMessage(db: AdminDb, memberId: number, name = '') {
  return createPersonalMessage(db, memberId, {
    type: 'welcome',
    title: `欢迎${name ? `，${name}` : ''}`,
    content: '你的伊娃东方舞学习档案已创建，可以在个人中心查看课程、成长、核销记录和证书。',
    actionUrl: '/dashboard/profile',
    businessType: 'member',
    businessId: memberId,
    dedupeKey: `welcome:member:${memberId}`,
    priority: 'important',
  });
}

export function createAuthorizationMessage(db: AdminDb, memberId: number, seriesId: number, sourceId: string | number) {
  const series = db.prepare('SELECT name FROM CourseSeries WHERE id=?').get<{ name?: string }>(seriesId);
  return createPersonalMessage(db, memberId, {
    type: 'course',
    title: '线上课程已开通',
    content: `《${clean(series?.name, '线上课程')}》已经加入你的线上学院。`,
    actionUrl: `/courses/${seriesId}/videos`,
    businessType: 'course_authorization',
    businessId: sourceId,
    dedupeKey: `course-authorization:${seriesId}:${memberId}:${sourceId}`,
    priority: 'important',
    payload: { seriesId },
  });
}

export function createConsumeMessage(db: AdminDb, input: {
  memberId: number;
  consumeId: string | number;
  courseName: string;
  count: number;
  remainingAfter: number;
  reversed?: boolean;
}) {
  return createPersonalMessage(db, input.memberId, {
    type: 'consume',
    title: input.reversed ? '核销已撤销' : '课次核销成功',
    content: input.reversed
      ? `《${input.courseName}》核销已撤销，${input.count} 课次已返还，当前剩余 ${input.remainingAfter} 课次。`
      : `《${input.courseName}》已核销 ${input.count} 课次，剩余 ${input.remainingAfter} 课次。`,
    actionUrl: '/dashboard/progress',
    businessType: input.reversed ? 'consume_reversal' : 'consume_record',
    businessId: input.consumeId,
    dedupeKey: `${input.reversed ? 'consume-reversal' : 'consume'}:${input.consumeId}`,
    priority: 'important',
    payload: {
      count: input.count,
      remainingAfter: input.remainingAfter,
      courseName: input.courseName,
    },
  });
}

function createOrAggregateGrowthMessage(db: AdminDb, input: GrowthEventInput) {
  const day = dateKey(input.occurredAt || nowText());
  const dedupeKey = `growth-daily:${input.memberId}:${day}:${input.eventType}`;
  const existing = db.prepare('SELECT id, payload_json FROM InboxMessage WHERE dedupe_key=?')
    .get<{ id: number; payload_json?: string }>(dedupeKey);
  if (!existing) {
    return createPersonalMessage(db, input.memberId, {
      type: 'growth',
      title: `经验值 ${input.points >= 0 ? '+' : ''}${input.points}`,
      content: input.description,
      actionUrl: input.actionUrl || '/dashboard/messages?type=growth',
      businessType: 'experience',
      businessId: input.sourceId,
      dedupeKey,
      payload: { points: input.points, eventCount: 1, eventType: input.eventType },
    });
  }

  const payload = parseJson(existing.payload_json);
  const points = Number(payload.points || 0) + input.points;
  const eventCount = Number(payload.eventCount || 0) + 1;
  db.prepare(`
    UPDATE InboxMessage
    SET title=?, content=?, payload_json=?, updated_at=datetime('now','localtime')
    WHERE id=?
  `).run(
    `今日经验值 ${points >= 0 ? '+' : ''}${points}`,
    eventCount > 1 ? `今天已完成 ${eventCount} 项成长任务，累计经验 ${points >= 0 ? '+' : ''}${points}。` : input.description,
    safeJson({ ...payload, points, eventCount }),
    existing.id,
  );
  db.prepare(`
    UPDATE InboxRecipient
    SET status='unread', read_at=NULL, archived_at=NULL, created_at=datetime('now','localtime')
    WHERE message_id=? AND member_id=?
  `).run(existing.id, input.memberId);
  return { messageId: existing.id, recipients: 1, created: false };
}

export function ensureGrowthSchema(db: AdminDb) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS StudentGrowthSummary (
      user_id INTEGER PRIMARY KEY,
      experience_total INTEGER NOT NULL DEFAULT 0,
      level_no INTEGER NOT NULL DEFAULT 1,
      level_name TEXT NOT NULL DEFAULT '初舞学员',
      academy_started_at TEXT DEFAULT NULL,
      academy_started_source TEXT DEFAULT '',
      academy_override_at TEXT DEFAULT NULL,
      academy_override_source TEXT DEFAULT '',
      online_authorized_courses INTEGER NOT NULL DEFAULT 0,
      online_completed_lessons INTEGER NOT NULL DEFAULT 0,
      offline_completed_hours INTEGER NOT NULL DEFAULT 0,
      completed_courses INTEGER NOT NULL DEFAULT 0,
      total_learning_days INTEGER NOT NULL DEFAULT 0,
      current_streak_days INTEGER NOT NULL DEFAULT 0,
      longest_streak_days INTEGER NOT NULL DEFAULT 0,
      last_learning_at TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS ExperienceLedger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      points_delta INTEGER NOT NULL,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      idempotency_key TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      operator_id TEXT DEFAULT NULL,
      occurred_at TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS LevelChangeLog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      old_level INTEGER NOT NULL,
      new_level INTEGER NOT NULL,
      experience_total INTEGER NOT NULL,
      change_reason TEXT NOT NULL DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_experience_ledger_idempotency
      ON ExperienceLedger(idempotency_key);
    CREATE INDEX IF NOT EXISTS idx_experience_ledger_user
      ON ExperienceLedger(user_id, occurred_at DESC);
    CREATE INDEX IF NOT EXISTS idx_level_change_user
      ON LevelChangeLog(user_id, created_at DESC);
  `);
}

export function recordGrowthEvent(db: AdminDb, input: GrowthEventInput) {
  ensureInboxSchema(db);
  ensureGrowthSchema(db);
  const memberId = positiveInt(input.memberId);
  const points = Math.trunc(Number(input.points || 0));
  if (!memberId || !points) return { recorded: false, levelChanged: false };
  const occurredAt = clean(input.occurredAt, nowText());
  const idempotencyKey = `${input.eventType}:${input.sourceType}:${input.sourceId}:${memberId}`;

  const inserted = db.prepare(`
    INSERT OR IGNORE INTO ExperienceLedger (
      user_id, event_type, points_delta, source_type, source_id, idempotency_key,
      description, operator_id, occurred_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'))
  `).run(
    memberId,
    clean(input.eventType),
    points,
    clean(input.sourceType),
    clean(input.sourceId),
    idempotencyKey,
    clean(input.description),
    clean(input.operatorId) || null,
    occurredAt,
  );
  if (!inserted.changes) return { recorded: false, levelChanged: false };

  const previous = db.prepare('SELECT * FROM StudentGrowthSummary WHERE user_id=?')
    .get<Record<string, any>>(memberId);
  const oldExperience = Number(previous?.experience_total || 0);
  const oldLevel = Number(previous?.level_no || levelForExperience(oldExperience).no);
  const experienceTotal = Math.max(0, oldExperience + points);
  const level = levelForExperience(experienceTotal);

  db.prepare(`
    INSERT INTO StudentGrowthSummary (
      user_id, experience_total, level_no, level_name, last_learning_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, datetime('now','localtime'), datetime('now','localtime'))
    ON CONFLICT(user_id) DO UPDATE SET
      experience_total=excluded.experience_total,
      level_no=excluded.level_no,
      level_name=excluded.level_name,
      last_learning_at=excluded.last_learning_at,
      updated_at=excluded.updated_at
  `).run(memberId, experienceTotal, level.no, level.name, occurredAt);
  db.prepare('UPDATE Member SET level=? WHERE id=?').run(level.name, memberId);

  createOrAggregateGrowthMessage(db, input);
  const levelChanged = level.no > oldLevel;
  if (levelChanged) {
    db.prepare(`
      INSERT INTO LevelChangeLog (
        user_id, old_level, new_level, experience_total, change_reason, created_at
      ) VALUES (?, ?, ?, ?, ?, datetime('now','localtime'))
    `).run(memberId, oldLevel, level.no, experienceTotal, input.description);
    createPersonalMessage(db, memberId, {
      type: 'level_up',
      title: `恭喜升级为“${level.name}”`,
      content: `你的累计经验达到 ${experienceTotal}，已经从 ${LEVELS.find(item => item.no === oldLevel)?.name || '初舞学员'} 升级为 ${level.name}。`,
      actionUrl: '/dashboard/messages?type=growth',
      businessType: 'level_change',
      businessId: `${memberId}:${level.no}:${experienceTotal}`,
      dedupeKey: `level-up:${memberId}:${level.no}`,
      priority: 'urgent',
      payload: { oldLevel, newLevel: level.no, levelName: level.name, experienceTotal },
    });
  }
  return { recorded: true, levelChanged, experienceTotal, level };
}

export function publishCourseUpdate(db: AdminDb, input: {
  seriesId: number;
  title?: string;
  summary?: string;
  publishedBy?: string;
}) {
  ensureInboxSchema(db);
  const series = db.prepare('SELECT id, name FROM CourseSeries WHERE id=?')
    .get<{ id: number; name?: string }>(input.seriesId);
  if (!series) throw new Error('课程不存在');
  const releaseNo = Number(db.prepare(
    'SELECT COALESCE(MAX(release_no), 0) + 1 AS value FROM CourseContentRelease WHERE series_id=?',
  ).get<{ value: number }>(input.seriesId)?.value || 1);
  const lessonCount = Number(db.prepare(
    "SELECT COUNT(*) AS value FROM OnlineCourse WHERE series_id=? AND status='published'",
  ).get<{ value: number }>(input.seriesId)?.value || 0);
  const title = clean(input.title, `《${series.name || '线上课程'}》内容更新`);
  const summary = clean(input.summary, `课程内容已更新，当前共 ${lessonCount} 节课。`);
  const result = db.prepare(`
    INSERT INTO CourseContentRelease (
      series_id, release_no, title, summary, lesson_count, published_by, published_at
    ) VALUES (?, ?, ?, ?, ?, ?, datetime('now','localtime'))
  `).run(input.seriesId, releaseNo, title, summary, lessonCount, clean(input.publishedBy));
  const releaseId = Number(result.lastInsertRowid);
  const recipients = db.prepare(`
    SELECT DISTINCT m.id
    FROM CourseAuthorization ca
    JOIN Member m ON (
      ca.member_id=m.id
      OR (COALESCE(ca.phone,'')<>'' AND ca.phone=COALESCE(m.phone,''))
    )
    WHERE ca.series_id=? AND ca.status='active'
      AND (ca.expire_at IS NULL OR ca.expire_at>datetime('now','localtime'))
      AND COALESCE(m.status,'active')='active'
  `).all<{ id: number }>(input.seriesId).map(row => row.id);
  const message = createInboxMessage(db, {
    type: 'course',
    title,
    content: summary,
    actionUrl: `/courses/${input.seriesId}/videos`,
    businessType: 'course_release',
    businessId: releaseId,
    dedupeKey: `course-release:${input.seriesId}:${releaseNo}`,
    priority: 'important',
    payload: { seriesId: input.seriesId, releaseNo, lessonCount },
    memberIds: recipients,
  });
  return { releaseId, releaseNo, lessonCount, ...message };
}

export function createSystemAnnouncement(db: AdminDb, input: {
  title: string;
  content: string;
  actionUrl?: string;
  priority?: InboxPriority;
  expiresAt?: string;
  memberIds?: number[];
  dedupeKey?: string;
}) {
  ensureInboxSchema(db);
  const recipients = input.memberIds?.length
    ? input.memberIds
    : db.prepare("SELECT id FROM Member WHERE COALESCE(status,'active')='active'")
      .all<{ id: number }>().map(row => row.id);
  return createInboxMessage(db, {
    type: 'system',
    title: input.title,
    content: input.content,
    actionUrl: input.actionUrl,
    businessType: 'announcement',
    businessId: '',
    dedupeKey: input.dedupeKey || `announcement:${Date.now()}`,
    priority: input.priority || 'important',
    expiresAt: input.expiresAt,
    memberIds: recipients,
  });
}

export function unreadInboxCount(db: AdminDb, memberId: number) {
  ensureInboxSchema(db);
  return Number(db.prepare(`
    SELECT COUNT(*) AS count
    FROM InboxRecipient r
    JOIN InboxMessage m ON m.id=r.message_id
    WHERE r.member_id=? AND r.status='unread'
      AND (m.expires_at IS NULL OR m.expires_at>datetime('now','localtime'))
  `).get<{ count: number }>(memberId)?.count || 0);
}

export function listInboxMessages(db: AdminDb, input: {
  memberId: number;
  type?: string;
  status?: string;
  cursor?: number;
  limit?: number;
}) {
  ensureInboxSchema(db);
  const conditions = [
    'r.member_id=?',
    "r.status<>'archived'",
    "(m.expires_at IS NULL OR m.expires_at>datetime('now','localtime'))",
  ];
  const params: unknown[] = [input.memberId];
  if (clean(input.type) && input.type !== 'all') {
    conditions.push('m.type=?');
    params.push(input.type);
  }
  if (input.status === 'unread' || input.status === 'read') {
    conditions.push('r.status=?');
    params.push(input.status);
  }
  if (positiveInt(input.cursor)) {
    conditions.push('r.id<?');
    params.push(positiveInt(input.cursor));
  }
  const limit = Math.min(50, Math.max(1, positiveInt(input.limit) || 20));
  params.push(limit + 1);
  const rows = db.prepare(`
    SELECT r.id AS recipient_id, r.status, r.read_at, r.created_at,
           m.id, m.type, m.title, m.content, m.action_url, m.business_type,
           m.business_id, m.priority, m.payload_json, m.expires_at
    FROM InboxRecipient r
    JOIN InboxMessage m ON m.id=r.message_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY r.id DESC
    LIMIT ?
  `).all<Record<string, any>>(...params);
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit).map(row => ({
    id: String(row.id),
    recipientId: String(row.recipient_id),
    type: row.type,
    title: row.title,
    content: row.content,
    actionUrl: row.action_url || '',
    businessType: row.business_type || '',
    businessId: row.business_id || '',
    priority: row.priority || 'normal',
    payload: parseJson(row.payload_json),
    status: row.status,
    readAt: row.read_at || '',
    createdAt: row.created_at,
    expiresAt: row.expires_at || '',
  }));
  return {
    items,
    unreadCount: unreadInboxCount(db, input.memberId),
    nextCursor: hasMore ? Number(items[items.length - 1]?.recipientId || 0) : 0,
    hasMore,
  };
}

export function markInboxRead(db: AdminDb, memberId: number, recipientId: number) {
  ensureInboxSchema(db);
  return Number(db.prepare(`
    UPDATE InboxRecipient
    SET status='read', read_at=datetime('now','localtime')
    WHERE id=? AND member_id=? AND status='unread'
  `).run(recipientId, memberId).changes || 0);
}

export function markAllInboxRead(db: AdminDb, memberId: number) {
  ensureInboxSchema(db);
  return Number(db.prepare(`
    UPDATE InboxRecipient
    SET status='read', read_at=datetime('now','localtime')
    WHERE member_id=? AND status='unread'
  `).run(memberId).changes || 0);
}

export function runInboxReminderJobs(db: AdminDb, referenceTime = nowText()) {
  ensureInboxSchema(db);
  const runKey = `reminders:${referenceTime.slice(0, 13)}`;
  const claimed = db.prepare(`
    INSERT OR IGNORE INTO InboxJobRun (job_type, run_key, started_at)
    VALUES ('reminders', ?, datetime('now','localtime'))
  `).run(runKey);
  if (!claimed.changes) return { skipped: true, created: 0 };

  let created = 0;
  const courseColumns = new Set(db.prepare('PRAGMA table_info(Course)').all<{ name: string }>().map(row => row.name));
  if (courseColumns.has('startDate')) {
    const starts = db.prepare(`
      SELECT DISTINCT p.memberId AS member_id, p.id AS payment_id, p.courseName AS course_name,
             c.startDate AS start_at
      FROM Payment p
      JOIN Course c ON c.id=p.courseId
      JOIN Member m ON m.id=p.memberId
      WHERE COALESCE(p.remainingSessions,0)>0
        AND COALESCE(c.startDate,'')<>''
        AND COALESCE(m.status,'active')='active'
        AND julianday(c.startDate)-julianday(?) BETWEEN 0 AND 1.05
    `).all<Record<string, any>>(referenceTime);
    starts.forEach(row => {
      created += createPersonalMessage(db, Number(row.member_id), {
        type: 'offline',
        title: '线下课程即将开课',
        content: `《${row.course_name || '线下课程'}》将在 24 小时内开课，请提前安排时间。`,
        actionUrl: '/dashboard/profile#offline-courses',
        businessType: 'course_start',
        businessId: row.payment_id,
        dedupeKey: `course-start-24h:${row.payment_id}:${String(row.start_at).slice(0, 16)}`,
        priority: 'urgent',
      }).recipients;
    });
  }

  const paymentColumns = new Set(db.prepare('PRAGMA table_info(Payment)').all<{ name: string }>().map(row => row.name));
  if (paymentColumns.has('expireDate')) {
    const expires = db.prepare(`
      SELECT p.memberId AS member_id, p.id AS payment_id, p.courseName AS course_name,
             p.expireDate AS expire_at
      FROM Payment p
      JOIN Member m ON m.id=p.memberId
      WHERE COALESCE(p.remainingSessions,0)>0
        AND COALESCE(p.expireDate,'')<>''
        AND COALESCE(m.status,'active')='active'
        AND julianday(substr(p.expireDate,1,10))-julianday(substr(?,1,10)) BETWEEN 6 AND 7
    `).all<Record<string, any>>(referenceTime);
    expires.forEach(row => {
      created += createPersonalMessage(db, Number(row.member_id), {
        type: 'offline',
        title: '课程即将到期',
        content: `《${row.course_name || '课程'}》将在 7 天内到期，当前仍有可用课次。`,
        actionUrl: '/dashboard/profile#offline-courses',
        businessType: 'course_expiry',
        businessId: row.payment_id,
        dedupeKey: `course-expiry-7d:${row.payment_id}:${String(row.expire_at).slice(0, 10)}`,
        priority: 'important',
      }).recipients;
    });
  }
  db.prepare(`
    UPDATE InboxJobRun
    SET created_count=?, detail=?, finished_at=datetime('now','localtime')
    WHERE run_key=?
  `).run(created, safeJson({ referenceTime }), runKey);
  return { skipped: false, created };
}
