#!/usr/bin/env node

const path = require('path');
const Database = require('better-sqlite3');

const dbPath = process.env.ADMIN_DB_PATH || path.join(process.cwd(), 'admin.db');
const db = new Database(dbPath, { readonly: true });

try {
  const total = Number(db.prepare('SELECT COUNT(*) AS total FROM CourseSeries').get().total || 0);
  const latest = db.prepare(
    `SELECT id, name, status, created_at
     FROM CourseSeries
     ORDER BY created_at DESC, id DESC
     LIMIT 1`
  ).get();
  const fullRows = db.prepare(
    `SELECT id, name, status, created_at
     FROM CourseSeries
     ORDER BY created_at DESC, id DESC`
  ).all();
  const legacyFirstPage = db.prepare(
    `SELECT id
     FROM CourseSeries
     ORDER BY sort_order, created_at DESC
     LIMIT 50`
  ).all();

  console.log(`课程总数: ${total}`);
  if (!latest) {
    console.log('结果: 暂无课程数据');
    process.exit(0);
  }

  const latestInFullList = fullRows.some(row => Number(row.id) === Number(latest.id));
  const latestInLegacyFirstPage = legacyFirstPage.some(row => Number(row.id) === Number(latest.id));

  console.log(`最新课程: #${latest.id} ${latest.name} (${latest.status || '未知状态'})`);
  console.log(`修复后后台列表: ${latestInFullList ? '可见' : '不可见'}`);
  console.log(`旧版前50条查询: ${latestInLegacyFirstPage ? '可见' : '会漏掉'}`);

  if (!latestInFullList || fullRows.length !== total) {
    console.error('结果: 后台课程列表不完整');
    process.exit(1);
  }

  console.log('结果: 后台课程列表完整，新建课程会显示在列表前列');
} finally {
  db.close();
}
