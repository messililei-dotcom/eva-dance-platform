BEGIN;

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

COMMIT;
