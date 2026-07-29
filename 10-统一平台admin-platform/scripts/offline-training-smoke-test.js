const path = require("path");

const testDbPath = process.env.OFFLINE_TEST_DB_PATH;
const compiledServicePath = process.env.OFFLINE_SERVICE_PATH;

if (!testDbPath || !compiledServicePath) {
  throw new Error("请配置 OFFLINE_TEST_DB_PATH 和 OFFLINE_SERVICE_PATH");
}
if (path.basename(testDbPath) === "admin.db") {
  throw new Error("禁止在正式 admin.db 上运行课次冒烟测试");
}

const Database = require("better-sqlite3");
const {
  backfillOfflineEntitlements,
  cancelOfflineBooking,
  checkinOfflineBooking,
  createOfflineBooking,
  createOfflineSession,
  ensureOfflineTrainingTables,
  openOfflineCheckin,
} = require(compiledServicePath);

function assert(condition, message) {
  if (!condition) throw new Error(`断言失败：${message}`);
}

const db = new Database(testDbPath);

try {
  ensureOfflineTrainingTables(db);
  const migration = backfillOfflineEntitlements(db);
  const activeTotals = db.prepare(`
    SELECT COUNT(*) AS count,
           COALESCE(SUM(available_sessions),0) AS available,
           COALESCE(SUM(frozen_sessions),0) AS frozen,
           COALESCE(SUM(used_sessions),0) AS used
    FROM OfflineEntitlement WHERE status='active'
  `).get();

  assert(activeTotals.available === 999, `历史可用课次应为999，实际为${activeTotals.available}`);
  assert(activeTotals.frozen === 0, `迁移后冻结课次应为0，实际为${activeTotals.frozen}`);

  const entitlement = db.prepare(`
    SELECT e.* FROM OfflineEntitlement e
    JOIN Course c ON c.id=e.course_id
    JOIN Payment p ON p.id=e.payment_id
    WHERE e.status='active' AND e.available_sessions>=2
    ORDER BY e.available_sessions DESC LIMIT 1
  `).get();
  assert(entitlement, "需要至少一条有2个可用课次的测试权益");

  const originalPayment = db.prepare("SELECT * FROM Payment WHERE id=?").get(entitlement.payment_id);
  const originalAvailable = entitlement.available_sessions;
  const originalUsed = entitlement.used_sessions;

  const session = createOfflineSession(db, {
    courseId: entitlement.course_id,
    sessionDate: "2099-12-20",
    startTime: "09:30",
    endTime: "12:00",
    teacherName: "集成测试老师",
    classroom: "测试教室",
    capacity: 1,
    bookingCloseAt: "2099-12-20 09:30",
    cancelDeadlineAt: "2099-12-19 21:30",
    checkinOpenAt: "2020-01-01 00:00",
    checkinCloseAt: "2099-12-20 10:00",
    status: "published",
  });

  const booking = createOfflineBooking(db, {
    memberId: entitlement.member_id,
    sessionId: session.id,
    source: "smoke_test",
  });
  let changed = db.prepare("SELECT * FROM OfflineEntitlement WHERE id=?").get(entitlement.id);
  assert(changed.available_sessions === originalAvailable - 1, "预约应减少1个可用课次");
  assert(changed.frozen_sessions === 1, "预约应冻结1课次");

  cancelOfflineBooking(db, booking.id, entitlement.member_id, "冒烟测试取消");
  changed = db.prepare("SELECT * FROM OfflineEntitlement WHERE id=?").get(entitlement.id);
  assert(changed.available_sessions === originalAvailable, "取消应返还1个可用课次");
  assert(changed.frozen_sessions === 0, "取消后冻结课次应归零");

  const rebooked = createOfflineBooking(db, {
    memberId: entitlement.member_id,
    sessionId: session.id,
    source: "smoke_test_rebook",
  });
  assert(rebooked.id === booking.id, "取消后重新预约应安全复用预约记录");

  const checkinCode = openOfflineCheckin(db, session.id, "冒烟测试").checkinCode;
  const checkin = checkinOfflineBooking(db, {
    bookingId: rebooked.id,
    memberId: entitlement.member_id,
    checkinCode,
  });
  assert(checkin.repeated === false, "首次签到不应标记为重复");
  assert(checkin.remainingSessions === originalPayment.remainingSessions - 1, "签到应扣减Payment剩余课次");

  changed = db.prepare("SELECT * FROM OfflineEntitlement WHERE id=?").get(entitlement.id);
  assert(changed.available_sessions === originalAvailable - 1, "核销后可用课次保持预约后的数值");
  assert(changed.frozen_sessions === 0, "核销后冻结课次应归零");
  assert(changed.used_sessions === originalUsed + 1, "核销后已用课次应增加1");

  const consumeBeforeRepeat = db.prepare("SELECT COUNT(*) AS count FROM ConsumeRecord WHERE bookingId=?").get(rebooked.id).count;
  const repeated = checkinOfflineBooking(db, {
    bookingId: rebooked.id,
    memberId: entitlement.member_id,
    checkinCode,
  });
  const consumeAfterRepeat = db.prepare("SELECT COUNT(*) AS count FROM ConsumeRecord WHERE bookingId=?").get(rebooked.id).count;
  assert(repeated.repeated === true, "重复扫码应返回幂等结果");
  assert(consumeBeforeRepeat === 1 && consumeAfterRepeat === 1, "重复扫码不能产生第二条核销");

  const capacityBlocked = (() => {
    let secondEntitlement = db.prepare(`
      SELECT * FROM OfflineEntitlement
      WHERE status='active' AND course_id=? AND member_id<>? AND available_sessions>0
      LIMIT 1
    `).get(entitlement.course_id, entitlement.member_id);
    if (!secondEntitlement) {
      const secondMember = db.prepare("SELECT id FROM Member WHERE id<>? ORDER BY id LIMIT 1").get(entitlement.member_id);
      assert(secondMember, "容量测试需要第二名学员");
      const enrollmentId = db.prepare(`
        INSERT INTO OfflineEnrollment (
          enrollment_no, member_id, course_id, payment_id, status, channel, amount, activated_at, remark
        ) VALUES (?, ?, ?, 0, 'active', 'smoke_test', 0, datetime('now'), '容量保护测试')
      `).run(`SMOKE-CAPACITY-${Date.now()}`, secondMember.id, entitlement.course_id).lastInsertRowid;
      const entitlementId = db.prepare(`
        INSERT INTO OfflineEntitlement (
          member_id, course_id, enrollment_id, payment_id, total_sessions,
          available_sessions, frozen_sessions, used_sessions, status
        ) VALUES (?, ?, ?, 0, 1, 1, 0, 0, 'active')
      `).run(secondMember.id, entitlement.course_id, enrollmentId).lastInsertRowid;
      secondEntitlement = db.prepare("SELECT * FROM OfflineEntitlement WHERE id=?").get(entitlementId);
    }
    try {
      createOfflineBooking(db, {
        memberId: secondEntitlement.member_id,
        sessionId: session.id,
        source: "capacity_test",
      });
      return false;
    } catch (error) {
      return /满员/.test(error.message);
    }
  })();
  assert(capacityBlocked === true, "满员课次必须拒绝新的预约");

  console.log(JSON.stringify({
    passed: true,
    migration,
    verified: {
      historicalAvailableSessions: activeTotals.available,
      bookingFreezesOneSession: true,
      cancellationReturnsOneSession: true,
      rebookingAfterCancellation: true,
      checkinConsumesOneSession: true,
      repeatedCheckinIsIdempotent: true,
      capacityGuard: capacityBlocked,
    },
  }, null, 2));
} finally {
  db.close();
}
