BEGIN IMMEDIATE;

DROP INDEX IF EXISTS idx_growth_academy_start;
DROP INDEX IF EXISTS idx_growth_level;
DROP INDEX IF EXISTS idx_level_change_user;
DROP INDEX IF EXISTS idx_experience_ledger_source;
DROP INDEX IF EXISTS idx_experience_ledger_event;
DROP INDEX IF EXISTS idx_experience_ledger_user;
DROP INDEX IF EXISTS idx_experience_ledger_idempotency;
DROP TABLE IF EXISTS GrowthRecalculationRun;
DROP TABLE IF EXISTS AcademyStartAudit;
DROP TABLE IF EXISTS LevelChangeLog;
DROP TABLE IF EXISTS ExperienceLedger;
DROP TABLE IF EXISTS StudentGrowthSummary;

COMMIT;
