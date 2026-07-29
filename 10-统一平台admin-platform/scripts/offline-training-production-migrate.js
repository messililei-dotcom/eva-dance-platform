const path = require("path");

if (process.env.ALLOW_PRODUCTION_OFFLINE_MIGRATION !== "1") {
  throw new Error("未授权执行正式课次迁移");
}

const dbPath = process.env.ADMIN_DB_PATH;
const servicePath = process.env.OFFLINE_SERVICE_PATH;
if (!dbPath || !path.isAbsolute(dbPath)) throw new Error("ADMIN_DB_PATH 必须是绝对路径");
if (!servicePath || !path.isAbsolute(servicePath)) throw new Error("OFFLINE_SERVICE_PATH 必须是绝对路径");

const Database = require("better-sqlite3");
const { backfillOfflineEntitlements, ensureOfflineTrainingTables } = require(servicePath);
const db = new Database(dbPath);

function assert(condition, message) {
  if (!condition) throw new Error(`迁移校验失败：${message}`);
}

try {
  db.pragma("busy_timeout = 30000");
  const before = db.prepare(`
    SELECT COUNT(*) AS payments,
           COALESCE(SUM(CASE WHEN paymentStatus IN ('paid','completed') THEN remainingSessions ELSE 0 END),0) AS remaining
    FROM Payment
  `).get();
  const beforeCheck = db.pragma("quick_check", { simple: true });
  assert(beforeCheck === "ok", `迁移前数据库检查结果为 ${beforeCheck}`);

  ensureOfflineTrainingTables(db);
  const result = backfillOfflineEntitlements(db);

  const after = db.prepare(`
    SELECT COUNT(*) AS payments,
           COALESCE(SUM(CASE WHEN paymentStatus IN ('paid','completed') THEN remainingSessions ELSE 0 END),0) AS remaining
    FROM Payment
  `).get();
  const rights = db.prepare(`
    SELECT COUNT(*) AS entitlements,
           COALESCE(SUM(CASE WHEN status='active' THEN available_sessions ELSE 0 END),0) AS available,
           COALESCE(SUM(CASE WHEN status='active' THEN frozen_sessions ELSE 0 END),0) AS frozen
    FROM OfflineEntitlement
  `).get();
  const tableCount = db.prepare(`
    SELECT COUNT(*) AS count FROM sqlite_master
    WHERE type='table' AND name IN (
      'OfflineEnrollment','OfflineEntitlement','OfflineSession',
      'OfflineBooking','OfflineAttendance','OfflineCheckinToken'
    )
  `).get().count;

  assert(before.payments === after.payments, "迁移不得改变缴费记录数量");
  assert(before.remaining === after.remaining, "迁移不得改变原剩余课次");
  assert(rights.entitlements === before.payments, "每笔缴费必须生成且仅生成一条课次权益");
  assert(rights.available === before.remaining, "权益可用课次必须等于原有效剩余课次");
  assert(rights.frozen === 0, "首次迁移冻结课次必须为0");
  assert(tableCount === 6, "六张线下课次业务表必须全部存在");
  const afterCheck = db.pragma("quick_check", { simple: true });
  assert(afterCheck === "ok", `迁移后数据库检查结果为 ${afterCheck}`);

  console.log(JSON.stringify({
    success: true,
    before,
    after,
    rights,
    tableCount,
    quickCheck: afterCheck,
    migration: result,
  }, null, 2));
} finally {
  db.close();
}
