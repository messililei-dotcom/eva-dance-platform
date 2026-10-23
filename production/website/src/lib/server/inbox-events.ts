import type { AdminDb } from '@/lib/server/admin-db';

const LEVELS = [
  { no: 1, name: '初舞学员', min: 0 },
  { no: 2, name: '律动学员', min: 1000 },
  { no: 3, name: '舞韵学员', min: 5000 },
  { no: 4, name: '资深舞者', min: 15000 },
  { no: 5, name: '卓越舞者', min: 30000 },
];

function levelFor(experience: number) {
  return [...LEVELS].reverse().find(item => experience >= item.min) || LEVELS[0];
}

function nowText() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    dateStyle: 'short',
    timeStyle: 'medium',
    hour12: false,
  }).format(new Date());
}

export function ensureInboxEventSchema(db: AdminDb) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS InboxMessage (
      id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '', action_url TEXT NOT NULL DEFAULT '',
      business_type TEXT NOT NULL DEFAULT '', business_id TEXT NOT NULL DEFAULT '',
      dedupe_key TEXT NOT NULL UNIQUE, priority TEXT NOT NULL DEFAULT 'normal',
      payload_json TEXT NOT NULL DEFAULT '{}', expires_at DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS InboxRecipient (
      id INTEGER PRIMARY KEY AUTOINCREMENT, message_id INTEGER NOT NULL, member_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'unread', read_at DATETIME DEFAULT NULL,
      archived_at DATETIME DEFAULT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(message_id, member_id)
    );
    CREATE TABLE IF NOT EXISTS StudentGrowthSummary (
      user_id INTEGER PRIMARY KEY, experience_total INTEGER NOT NULL DEFAULT 0,
      level_no INTEGER NOT NULL DEFAULT 1, level_name TEXT NOT NULL DEFAULT '初舞学员',
      last_learning_at TEXT DEFAULT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS ExperienceLedger (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, event_type TEXT NOT NULL,
      points_delta INTEGER NOT NULL, source_type TEXT NOT NULL, source_id TEXT NOT NULL,
      idempotency_key TEXT NOT NULL UNIQUE, description TEXT NOT NULL DEFAULT '',
      operator_id TEXT DEFAULT NULL, occurred_at TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS LevelChangeLog (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, old_level INTEGER NOT NULL,
      new_level INTEGER NOT NULL, experience_total INTEGER NOT NULL,
      change_reason TEXT NOT NULL DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_inbox_recipient_member_status_created
      ON InboxRecipient(member_id, status, created_at DESC, id DESC);
  `);
}

export function createLocalInboxMessage(db: AdminDb, input: {
  memberId: number; type: string; title: string; content: string; actionUrl: string;
  businessType: string; businessId: string | number; dedupeKey: string;
  priority?: string; payload?: Record<string, unknown>;
}) {
  ensureInboxEventSchema(db);
  const existing = db.prepare('SELECT id FROM InboxMessage WHERE dedupe_key=?').get<{ id: number }>(input.dedupeKey);
  let messageId = Number(existing?.id || 0);
  if (!messageId) {
    const result = db.prepare(`
      INSERT INTO InboxMessage (
        type,title,content,action_url,business_type,business_id,dedupe_key,
        priority,payload_json,created_at,updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,datetime('now','localtime'),datetime('now','localtime'))
    `).run(input.type, input.title, input.content, input.actionUrl, input.businessType,
      String(input.businessId), input.dedupeKey, input.priority || 'normal', JSON.stringify(input.payload || {}));
    messageId = Number(result.lastInsertRowid);
  }
  db.prepare("INSERT OR IGNORE INTO InboxRecipient (message_id,member_id,status,created_at) VALUES (?,?,'unread',datetime('now','localtime'))")
    .run(messageId, input.memberId);
  return messageId;
}

export function createLocalWelcomeMessage(db: AdminDb, memberId: number, name: string) {
  return createLocalInboxMessage(db, {
    memberId, type: 'welcome', title: `欢迎${name ? `，${name}` : ''}`,
    content: '你的伊娃东方舞学习档案已创建，可以在个人中心查看课程、成长、核销记录和证书。',
    actionUrl: '/dashboard/profile', businessType: 'member', businessId: memberId,
    dedupeKey: `welcome:member:${memberId}`, priority: 'important',
  });
}

export function recordLocalGrowth(db: AdminDb, input: {
  memberId: number; eventType: string; points: number; sourceType: string;
  sourceId: string | number; description: string; actionUrl?: string;
}) {
  ensureInboxEventSchema(db);
  const key = `${input.eventType}:${input.sourceType}:${input.sourceId}:${input.memberId}`;
  const occurredAt = nowText();
  const inserted = db.prepare(`
    INSERT OR IGNORE INTO ExperienceLedger (
      user_id,event_type,points_delta,source_type,source_id,idempotency_key,description,occurred_at,created_at
    ) VALUES (?,?,?,?,?,?,?,?,datetime('now','localtime'))
  `).run(input.memberId, input.eventType, input.points, input.sourceType, String(input.sourceId), key, input.description, occurredAt);
  if (!inserted.changes) return false;
  const previous = db.prepare('SELECT * FROM StudentGrowthSummary WHERE user_id=?').get<Record<string, any>>(input.memberId);
  const experience = Math.max(0, Number(previous?.experience_total || 0) + input.points);
  const oldLevel = Number(previous?.level_no || 1);
  const level = levelFor(experience);
  db.prepare(`
    INSERT INTO StudentGrowthSummary (user_id,experience_total,level_no,level_name,last_learning_at,created_at,updated_at)
    VALUES (?,?,?,?,?,datetime('now','localtime'),datetime('now','localtime'))
    ON CONFLICT(user_id) DO UPDATE SET experience_total=excluded.experience_total,
      level_no=excluded.level_no,level_name=excluded.level_name,last_learning_at=excluded.last_learning_at,
      updated_at=excluded.updated_at
  `).run(input.memberId, experience, level.no, level.name, occurredAt);
  db.prepare('UPDATE Member SET level=? WHERE id=?').run(level.name, input.memberId);

  createLocalInboxMessage(db, {
    memberId: input.memberId, type: 'growth',
    title: `经验值 ${input.points >= 0 ? '+' : ''}${input.points}`, content: input.description,
    actionUrl: input.actionUrl || '/dashboard/messages?type=growth',
    businessType: 'experience', businessId: input.sourceId, dedupeKey: `growth:${key}`,
    payload: { points: input.points, eventType: input.eventType },
  });
  if (level.no > oldLevel) {
    db.prepare("INSERT INTO LevelChangeLog (user_id,old_level,new_level,experience_total,change_reason,created_at) VALUES (?,?,?,?,?,datetime('now','localtime'))")
      .run(input.memberId, oldLevel, level.no, experience, input.description);
    createLocalInboxMessage(db, {
      memberId: input.memberId, type: 'level_up', title: `恭喜升级为“${level.name}”`,
      content: `你的累计经验达到 ${experience}，已经升级为 ${level.name}。`,
      actionUrl: '/dashboard/messages?type=growth', businessType: 'level_change',
      businessId: `${input.memberId}:${level.no}`, dedupeKey: `level-up:${input.memberId}:${level.no}`,
      priority: 'urgent',
    });
  }
  return true;
}

export function createLocalConsumeMessage(db: AdminDb, input: {
  memberId: number; consumeId: string | number; courseName: string; remainingAfter: number;
}) {
  return createLocalInboxMessage(db, {
    memberId: input.memberId, type: 'consume', title: '课次核销成功',
    content: `《${input.courseName}》已核销 1 课次，剩余 ${input.remainingAfter} 课次。`,
    actionUrl: '/dashboard/progress', businessType: 'consume_record', businessId: input.consumeId,
    dedupeKey: `consume:${input.consumeId}`, priority: 'important',
  });
}
