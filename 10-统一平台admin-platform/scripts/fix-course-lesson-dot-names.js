#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function getBetterSqlite3() {
  try {
    return require('better-sqlite3');
  } catch {
    return require(path.resolve(process.cwd(), '../03-学员管理系统/学员管理系统/server/node_modules/better-sqlite3'));
  }
}

const KNOWN_FILE_EXTENSIONS = new Set([
  'mp4', 'm4a', 'mp3', 'mov', 'm4v', 'avi', 'mkv', 'webm',
  'wav', 'aac', 'flac', 'ogg',
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg',
  'pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'zip',
]);

function dbPath() {
  const configured = process.env.ADMIN_DB_PATH || process.env.UNIFIED_DB_PATH || 'admin.db';
  return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured);
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function legacyBrokenStrip(value) {
  const text = String(value || '').trim();
  return text.replace(/\.[^.\\/]+$/, '').trim() || text;
}

function stripKnownExtension(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const clean = text.split('?')[0].split('#')[0];
  const slashIndex = Math.max(clean.lastIndexOf('/'), clean.lastIndexOf('\\'));
  const filenameStart = slashIndex >= 0 ? slashIndex + 1 : 0;
  const dotIndex = clean.lastIndexOf('.');
  if (dotIndex <= filenameStart) return text;
  const ext = clean.slice(dotIndex + 1).toLowerCase();
  if (!KNOWN_FILE_EXTENSIONS.has(ext)) return text;
  return text.slice(0, dotIndex).trim() || text;
}

const filename = dbPath();
if (!fs.existsSync(filename)) {
  throw new Error(`Database not found: ${filename}`);
}

const backup = `/tmp/admin-db-before-lesson-dot-name-fix-${stamp()}.db`;
fs.copyFileSync(filename, backup);

const Database = getBetterSqlite3();
const db = new Database(filename);

try {
  const rows = db.prepare(`
    SELECT
      c.id AS course_id,
      c.name AS course_name,
      m.name AS material_name
    FROM OnlineCourse c
    JOIN CourseVideo cv ON cv.course_id = c.id
    JOIN Material m ON m.id = cv.material_id
    WHERE m.name IS NOT NULL AND TRIM(m.name) <> ''
    GROUP BY c.id
    HAVING COUNT(cv.id) = 1
    ORDER BY c.id
  `).all();

  const updates = [];
  for (const row of rows) {
    const expected = stripKnownExtension(row.material_name);
    const broken = legacyBrokenStrip(row.material_name);
    const current = String(row.course_name || '').trim();
    if (!expected || expected === broken) continue;
    if (current !== broken) continue;
    updates.push({
      course_id: row.course_id,
      from: current,
      to: expected,
      material_name: row.material_name,
    });
  }

  const update = db.prepare("UPDATE OnlineCourse SET name=?, updated_at=datetime('now','localtime') WHERE id=?");
  const tx = db.transaction((items) => {
    for (const item of items) update.run(item.to, item.course_id);
  });
  tx(updates);

  console.log(JSON.stringify({
    backup,
    scanned: rows.length,
    updated: updates.length,
    samples: updates.slice(0, 20),
  }, null, 2));
} finally {
  db.close();
}
