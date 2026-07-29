BEGIN IMMEDIATE;

CREATE TABLE IF NOT EXISTS StudentGrowthSummary (
  user_id INTEGER PRIMARY KEY,
  experience_total INTEGER NOT NULL DEFAULT 0 CHECK(experience_total >= 0),
  level_no INTEGER NOT NULL DEFAULT 1 CHECK(level_no BETWEEN 1 AND 5),
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

CREATE TABLE IF NOT EXISTS AcademyStartAudit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  old_started_at TEXT DEFAULT NULL,
  new_started_at TEXT NOT NULL,
  source TEXT NOT NULL,
  evidence TEXT NOT NULL,
  reason TEXT NOT NULL,
  operator_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS GrowthRecalculationRun (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mode TEXT NOT NULL,
  member_count INTEGER NOT NULL DEFAULT 0,
  event_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  detail TEXT DEFAULT '',
  operator_id TEXT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_experience_ledger_idempotency ON ExperienceLedger(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_experience_ledger_user ON ExperienceLedger(user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_experience_ledger_event ON ExperienceLedger(event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_experience_ledger_source ON ExperienceLedger(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_level_change_user ON LevelChangeLog(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_growth_level ON StudentGrowthSummary(level_no, last_learning_at);
CREATE INDEX IF NOT EXISTS idx_growth_academy_start ON StudentGrowthSummary(academy_started_at);

COMMIT;
