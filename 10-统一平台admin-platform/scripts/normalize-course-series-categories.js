#!/usr/bin/env node

const path = require('path');
const Database = require('better-sqlite3');

const root = path.resolve(__dirname, '..');
const db = new Database(path.join(root, 'admin.db'));
const execute = process.argv.includes('--execute');

const ONLINE = '线上系统课';
const DANCE = '成品舞';
const DANCE_PATTERN = /成品舞|经典|情感|国风|道具|民俗|现代融合|古典|作品/;
const ONLINE_PATTERN = /线上系统课|线上学院|线上课|网课|视频课|录播|系统课/;

function normalize(row) {
  const category = String(row.category || '').trim();
  if (category === ONLINE || category === DANCE) return category;
  const text = `${category} ${row.name || ''} ${row.subtitle || ''} ${row.source_type || ''}`;
  if (ONLINE_PATTERN.test(text) || row.source_type === 'official_online') return ONLINE;
  if (DANCE_PATTERN.test(text) || row.source_type === 'official_dance_collection') return DANCE;
  return ONLINE;
}

const rows = db.prepare('SELECT id, name, subtitle, category, source_type FROM CourseSeries ORDER BY id').all();
const changes = rows
  .map(row => ({ ...row, next_category: normalize(row) }))
  .filter(row => row.next_category !== String(row.category || '').trim());

console.log(JSON.stringify({
  execute,
  total: rows.length,
  changed: changes.length,
  before: rows.reduce((acc, row) => {
    const key = String(row.category || '未分类');
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {}),
  after: rows.reduce((acc, row) => {
    const key = normalize(row);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {}),
}, null, 2));

if (execute && changes.length) {
  const update = db.prepare("UPDATE CourseSeries SET category=?, updated_at=datetime('now','localtime') WHERE id=?");
  db.transaction(() => {
    for (const row of changes) update.run(row.next_category, row.id);
  })();
}

db.close();
