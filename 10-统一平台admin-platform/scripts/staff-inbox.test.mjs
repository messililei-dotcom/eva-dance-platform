import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import Database from 'better-sqlite3';
import {
  createConsultationAndNotifyStaff,
  listStaffInboxMessages,
} from '../src/lib/server/staff-inbox.ts';

function createTestDb() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'eva-staff-inbox-'));
  const db = new Database(path.join(directory, 'test.db'));
  db.exec(`
    CREATE TABLE User (
      id INTEGER PRIMARY KEY,
      username TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT NOT NULL
    );
    INSERT INTO User VALUES
      (1, 'admin', '管理员', 'admin', 'active'),
      (2, 'teacher', '老师', 'teacher', 'active'),
      (3, 'disabled', '停用老师', 'teacher', 'disabled'),
      (4, 'member', '普通账号', 'member', 'active');
  `);
  return { db, directory };
}

test('咨询报名只向启用中的管理员和老师投递站内信', () => {
  const { db, directory } = createTestDb();
  try {
    const result = createConsultationAndNotifyStaff(db, {
      name: '测试学员',
      phone: '13800138000',
      courseId: 101,
      courseName: 'SWOD系统集训',
      channel: 'website',
    });
    assert.equal(result.recipients, 2);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM ConsultationRequest').get().count, 1);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM StaffInboxMessage').get().count, 1);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM StaffInboxRecipient').get().count, 2);
    const messages = listStaffInboxMessages(db, 2);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].phone, '13800138000');
    assert.equal(messages[0].course_id, 101);
    assert.equal(messages[0].course_name, 'SWOD系统集训');
  } finally {
    db.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('一分钟内重复提交不会产生重复咨询或重复站内信', () => {
  const { db, directory } = createTestDb();
  try {
    const input = {
      name: '测试学员',
      phone: '13800138000',
      courseId: 101,
      courseName: 'SWOD系统集训',
    };
    createConsultationAndNotifyStaff(db, input);
    const repeated = createConsultationAndNotifyStaff(db, input);
    assert.equal(repeated.repeated, true);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM ConsultationRequest').get().count, 1);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM StaffInboxMessage').get().count, 1);
  } finally {
    db.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
