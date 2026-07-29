import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import {
  adminAdjustExperience, backfillAllGrowth, ensureGrowthTables, getGrowthSummary,
  levelForExperience, reconcileCourseAuthorization, reconcileOfflineCheckin, reconcileOfflinePayment,
  recordOnlineLessonCompletion,
} from '../src/lib/server/student-growth.ts';

function fixture() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE Member (id INTEGER PRIMARY KEY,name TEXT,phone TEXT,level TEXT,status TEXT DEFAULT 'active');
    CREATE TABLE Payment (id INTEGER PRIMARY KEY,memberId INTEGER,amount REAL,date TEXT,paymentStatus TEXT,created_at TEXT);
    CREATE TABLE ConsumeRecord (id INTEGER PRIMARY KEY,memberId INTEGER,count INTEGER,consumeDate TEXT,created_at TEXT);
    CREATE TABLE CourseSeries (id INTEGER PRIMARY KEY,name TEXT,price REAL,promo_price REAL,is_free INTEGER DEFAULT 0,status TEXT DEFAULT 'published');
    CREATE TABLE CourseAuthorization (id INTEGER PRIMARY KEY,member_id INTEGER,series_id INTEGER,type TEXT,status TEXT,granted_at TEXT,created_at TEXT,expire_at TEXT);
    CREATE TABLE FinanceIncome (id INTEGER PRIMARY KEY,incomeNo TEXT,amount REAL);
    CREATE TABLE CourseOrder (id INTEGER PRIMARY KEY,member_id INTEGER,amount REAL,status TEXT,paid_at TEXT,created_at TEXT);
    CREATE TABLE OnlineCourse (id INTEGER PRIMARY KEY,series_id INTEGER,status TEXT);
    CREATE TABLE CourseVideo (id INTEGER PRIMARY KEY,course_id INTEGER,is_free INTEGER,status TEXT);
    CREATE TABLE VideoProgress (id INTEGER PRIMARY KEY,member_id INTEGER,video_id INTEGER,completed INTEGER,last_play_at TEXT,created_at TEXT);
  `);
  db.prepare("INSERT INTO Member (id,name,phone,level) VALUES (1,'测试学员','13800138000','旧手工等级')").run();
  ensureGrowthTables(db);
  return db;
}

test('等级门槛完全由有效经验计算', () => {
  assert.equal(levelForExperience(0).no, 1);
  assert.equal(levelForExperience(999).no, 1);
  assert.equal(levelForExperience(1000).no, 2);
  assert.equal(levelForExperience(5000).no, 3);
  assert.equal(levelForExperience(15000).no, 4);
  assert.equal(levelForExperience(40000).no, 5);
});

test('1980 元付款重复回调只产生一次经验', () => {
  const db = fixture();
  db.prepare("INSERT INTO Payment VALUES (1,1,1980,'2026-01-01','paid','2026-01-01')").run();
  assert.equal(reconcileOfflinePayment(db, 1), true);
  assert.equal(reconcileOfflinePayment(db, 1), false);
  assert.equal(getGrowthSummary(db, 1).experience_total, 1980);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM ExperienceLedger WHERE source_type='offline_payment'").get().n, 1);
  assert.equal(db.prepare('SELECT level FROM Member WHERE id=1').get().level, '律动学员 Lv.2');
  db.close();
});

test('有效授权逐条产生线上消费及购买经验，撤销时冲正', () => {
  const db = fixture();
  db.prepare("INSERT INTO CourseSeries (id,name,price,promo_price) VALUES (1,'系统课',1299,999)").run();
  db.prepare("INSERT INTO CourseAuthorization VALUES (10,1,1,'admin_grant','active','2026-02-01','2026-02-01',NULL)").run();
  db.prepare("INSERT INTO FinanceIncome VALUES (1,'AUTH-10',999)").run();
  assert.equal(reconcileCourseAuthorization(db, 10), true);
  assert.equal(reconcileCourseAuthorization(db, 10), false);
  assert.equal(getGrowthSummary(db, 1).experience_total, 999);
  assert.equal(getGrowthSummary(db, 1).online_authorized_courses, 1);
  db.prepare("UPDATE CourseAuthorization SET status='revoked' WHERE id=10").run();
  assert.equal(reconcileCourseAuthorization(db, 10), true);
  assert.equal(getGrowthSummary(db, 1).experience_total, 0);
  assert.equal(getGrowthSummary(db, 1).online_authorized_courses, 0);
  db.close();
});

test('线下核销按课时计 10 点且连续 7/30 天奖励各一次', () => {
  const db = fixture();
  for (let day = 1; day <= 30; day += 1) {
    const date = `2026-03-${String(day).padStart(2, '0')}`;
    db.prepare('INSERT INTO ConsumeRecord VALUES (?,?,?,?,?)').run(day, 1, 1, date, date);
    reconcileOfflineCheckin(db, day);
  }
  assert.deepEqual(db.prepare("SELECT COUNT(*) n,SUM(points_delta) points FROM ExperienceLedger WHERE event_type='streak_7'").get(), { n: 1, points: 10 });
  assert.deepEqual(db.prepare("SELECT COUNT(*) n,SUM(points_delta) points FROM ExperienceLedger WHERE event_type='streak_30'").get(), { n: 1, points: 50 });
  assert.equal(getGrowthSummary(db, 1).experience_total, 360);
  assert.equal(getGrowthSummary(db, 1).longest_streak_days, 30);
  db.close();
});

test('人工经验只能通过带原因流水调整并触发自动升降级', () => {
  const db = fixture();
  assert.throws(() => adminAdjustExperience(db, { memberId: 1, points: 15000, reason: '', operatorId: 'admin' }), /原因/);
  adminAdjustExperience(db, { memberId: 1, points: 15000, reason: '历史凭证补录', operatorId: 'admin' });
  assert.equal(getGrowthSummary(db, 1).level_no, 4);
  adminAdjustExperience(db, { memberId: 1, points: -14001, reason: '异常数据冲正', operatorId: 'admin' });
  assert.equal(getGrowthSummary(db, 1).level_no, 1);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM LevelChangeLog WHERE user_id=1').get().n, 2);
  db.close();
});

test('历史回算重复执行不会重复增长', () => {
  const db = fixture();
  db.prepare("INSERT INTO Payment VALUES (1,1,1980,'2025-01-03','paid','2025-01-03')").run();
  db.prepare("INSERT INTO ConsumeRecord VALUES (1,1,1,'2025-01-02','2025-01-02')").run();
  const first = backfillAllGrowth(db, true, 'test');
  const countAfterFirst = db.prepare('SELECT COUNT(*) n FROM ExperienceLedger').get().n;
  const totalAfterFirst = getGrowthSummary(db, 1).experience_total;
  const second = backfillAllGrowth(db, true, 'test');
  assert.equal(first.errors.length, 0);
  assert.equal(second.errors.length, 0);
  assert.equal(second.insertedEvents, 0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM ExperienceLedger').get().n, countAfterFirst);
  assert.equal(getGrowthSummary(db, 1).experience_total, totalAfterFirst);
  assert.equal(getGrowthSummary(db, 1).academy_started_at, '2025-01-02');
  db.close();
});

test('不同学员完成同一课节时各自获得经验', () => {
  const db = fixture();
  db.prepare("INSERT INTO Member (id,name,phone,level) VALUES (2,'第二学员','13900139000','旧等级')").run();
  db.prepare("INSERT INTO CourseSeries (id,name,price,promo_price) VALUES (1,'共享课',100,100)").run();
  db.prepare("INSERT INTO OnlineCourse VALUES (1,1,'published')").run();
  db.prepare("INSERT INTO CourseVideo VALUES (1,1,0,'published')").run();
  db.prepare("INSERT INTO VideoProgress VALUES (1,1,1,1,'2026-04-01','2026-04-01')").run();
  db.prepare("INSERT INTO VideoProgress VALUES (2,2,1,1,'2026-04-01','2026-04-01')").run();
  recordOnlineLessonCompletion(db, 1, 1);
  recordOnlineLessonCompletion(db, 2, 1);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM ExperienceLedger WHERE event_type='online_lesson'").get().n, 2);
  assert.equal(getGrowthSummary(db, 1).online_completed_lessons, 1);
  assert.equal(getGrowthSummary(db, 2).online_completed_lessons, 1);
  db.close();
});
