import type { AdminDb } from './admin-db';

export type ConsultationInput = {
  name: string;
  phone: string;
  courseId: number;
  courseName: string;
  channel?: string;
};

function clean(value: unknown, fallback = '') {
  const text = String(value ?? '').normalize('NFC').trim();
  return text || fallback;
}

function ensureColumn(db: AdminDb, table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
  if (!columns.some(item => item.name === column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

export function ensureStaffInboxSchema(db: AdminDb) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ConsultationRequest (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      interest TEXT NOT NULL DEFAULT '线下课程',
      course_id INTEGER NOT NULL DEFAULT 0,
      course_name TEXT NOT NULL DEFAULT '',
      channel TEXT NOT NULL DEFAULT 'website',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS StaffInboxMessage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL DEFAULT 'consultation',
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      business_type TEXT NOT NULL DEFAULT '',
      business_id TEXT NOT NULL DEFAULT '',
      priority TEXT NOT NULL DEFAULT 'important',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS StaffInboxRecipient (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'unread',
      read_at DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(message_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_consultation_phone_created
      ON ConsultationRequest(phone, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_staff_inbox_recipient_user_status
      ON StaffInboxRecipient(user_id, status, created_at DESC);
  `);
  ensureColumn(db, 'ConsultationRequest', 'course_id', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'ConsultationRequest', 'course_name', "TEXT NOT NULL DEFAULT ''");
}

export function createConsultationAndNotifyStaff(db: AdminDb, input: ConsultationInput) {
  ensureStaffInboxSchema(db);
  const name = clean(input.name);
  const phone = clean(input.phone);
  const courseId = Number(input.courseId) || 0;
  const courseName = clean(input.courseName, '线下课程');
  const interest = `线下课程｜${courseName}`;
  const channel = clean(input.channel, 'website');

  const create = db.transaction(() => {
    const recent = db.prepare(`
      SELECT id FROM ConsultationRequest
      WHERE phone=? AND course_id=?
        AND datetime(created_at) >= datetime('now','localtime','-60 seconds')
      ORDER BY id DESC LIMIT 1
    `).get<{ id: number }>(phone, courseId);

    if (recent?.id) {
      const delivery = db.prepare(`
        SELECT m.id AS message_id, COUNT(r.id) AS recipients
        FROM StaffInboxMessage m
        LEFT JOIN StaffInboxRecipient r ON r.message_id=m.id
        WHERE m.business_type='consultation' AND m.business_id=?
        GROUP BY m.id
      `).get<{ message_id: number; recipients: number }>(recent.id);
      return {
        consultationId: recent.id,
        messageId: Number(delivery?.message_id || 0),
        recipients: Number(delivery?.recipients || 0),
        repeated: true,
      };
    }

    const consultation = db.prepare(`
      INSERT INTO ConsultationRequest (
        name, phone, interest, course_id, course_name, channel, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, datetime('now','localtime'), datetime('now','localtime'))
    `).run(name, phone, interest, courseId, courseName, channel);
    const consultationId = Number(consultation.lastInsertRowid);

    const message = db.prepare(`
      INSERT INTO StaffInboxMessage (
        type, title, content, business_type, business_id, priority, created_at
      ) VALUES ('consultation', ?, ?, 'consultation', ?, 'important', datetime('now','localtime'))
    `).run(
      '新的免费咨询报名',
      `姓名：${name}\n手机号：${phone}\n咨询课程：${courseName}`,
      consultationId,
    );
    const messageId = Number(message.lastInsertRowid);

    const recipients = db.prepare(`
      SELECT id FROM User
      WHERE status='active'
        AND role IN ('super_admin', 'admin', 'teacher', 'operator')
      ORDER BY id
    `).all<{ id: number }>();
    const insertRecipient = db.prepare(`
      INSERT OR IGNORE INTO StaffInboxRecipient (
        message_id, user_id, status, created_at
      ) VALUES (?, ?, 'unread', datetime('now','localtime'))
    `);
    let delivered = 0;
    recipients.forEach(recipient => {
      delivered += Number(insertRecipient.run(messageId, recipient.id).changes || 0);
    });

    return { consultationId, messageId, recipients: delivered, repeated: false };
  });

  return create();
}

export function listStaffInboxMessages(db: AdminDb, userId?: number) {
  ensureStaffInboxSchema(db);
  const params: unknown[] = [];
  const recipientFilter = userId ? 'AND r.user_id=?' : '';
  if (userId) params.push(userId);
  return db.prepare(`
    SELECT m.id, m.type, m.title, m.content, m.priority, m.created_at,
           r.status, r.read_at,
           c.id AS consultation_id, c.name, c.phone, c.interest,
           c.course_id, c.course_name, c.channel,
           c.status AS consultation_status
    FROM StaffInboxMessage m
    JOIN StaffInboxRecipient r ON r.message_id=m.id
    LEFT JOIN ConsultationRequest c
      ON m.business_type='consultation' AND c.id=CAST(m.business_id AS INTEGER)
    WHERE 1=1 ${recipientFilter}
    ORDER BY m.id DESC
    LIMIT 100
  `).all(...params);
}
