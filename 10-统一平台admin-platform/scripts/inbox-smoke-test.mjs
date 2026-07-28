import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import {
  createAuthorizationMessage,
  createConsumeMessage,
  createSystemAnnouncement,
  createWelcomeMessage,
  listInboxMessages,
  markAllInboxRead,
  markInboxRead,
  publishCourseUpdate,
  recordGrowthEvent,
  unreadInboxCount,
} from '../src/lib/server/inbox.ts';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eva-inbox-test-'));
const dbPath = path.join(tempDir, 'inbox.db');
const db = new Database(dbPath);

try {
  db.exec(`
    CREATE TABLE Member (id INTEGER PRIMARY KEY, name TEXT, phone TEXT, level TEXT, status TEXT DEFAULT 'active');
    CREATE TABLE CourseSeries (id INTEGER PRIMARY KEY, name TEXT);
    CREATE TABLE OnlineCourse (id INTEGER PRIMARY KEY, series_id INTEGER, status TEXT);
    CREATE TABLE CourseAuthorization (
      id INTEGER PRIMARY KEY, member_id INTEGER, phone TEXT, series_id INTEGER,
      status TEXT, expire_at TEXT
    );
    INSERT INTO Member (id,name,phone) VALUES (1,'测试学员','13800000000'),(2,'第二学员','13900000000');
    INSERT INTO CourseSeries (id,name) VALUES (10,'测试线上课');
    INSERT INTO OnlineCourse (id,series_id,status) VALUES (100,10,'published');
    INSERT INTO CourseAuthorization (id,member_id,phone,series_id,status) VALUES (1,1,'13800000000',10,'active');
  `);

  createWelcomeMessage(db, 1, '测试学员');
  createWelcomeMessage(db, 1, '测试学员');
  assert.equal(unreadInboxCount(db, 1), 1, '欢迎消息应幂等');

  createAuthorizationMessage(db, 1, 10, 1);
  createConsumeMessage(db, { memberId: 1, consumeId: 8, courseName: '线下课', count: 1, remainingAfter: 9 });
  assert.equal(unreadInboxCount(db, 1), 3);

  const growth = recordGrowthEvent(db, {
    memberId: 1,
    eventType: 'test_growth',
    points: 1000,
    sourceType: 'test',
    sourceId: 1,
    description: '测试成长',
  });
  assert.equal(growth.levelChanged, true);
  assert.equal(db.prepare('SELECT level FROM Member WHERE id=1').get().level, '律动学员');
  assert.equal(recordGrowthEvent(db, {
    memberId: 1,
    eventType: 'test_growth',
    points: 1000,
    sourceType: 'test',
    sourceId: 1,
    description: '重复成长',
  }).recorded, false, '成长流水应幂等');

  const release = publishCourseUpdate(db, { seriesId: 10, summary: '新增一节测试课程' });
  assert.equal(release.recipients, 1);

  const announcement = createSystemAnnouncement(db, { title: '测试公告', content: '公告内容' });
  assert.equal(announcement.recipients, 2);
  const page = listInboxMessages(db, { memberId: 1, limit: 20 });
  assert.ok(page.items.length >= 6);
  assert.equal(markInboxRead(db, 1, Number(page.items[0].recipientId)), 1);
  assert.ok(markAllInboxRead(db, 1) >= 1);
  assert.equal(unreadInboxCount(db, 1), 0);
  console.log(JSON.stringify({ success: true, messages: page.items.length, releaseRecipients: release.recipients }));
} finally {
  db.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
}
