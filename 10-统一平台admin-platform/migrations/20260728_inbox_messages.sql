BEGIN IMMEDIATE;

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

COMMIT;
