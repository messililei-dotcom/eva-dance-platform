#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const projectRoot = path.resolve(__dirname, '..');
const publicRoot = path.join(projectRoot, 'public');
const db = new Database(path.join(projectRoot, process.env.ADMIN_DB_PATH || 'admin.db'));

function args() {
  const values = new Set(process.argv.slice(2));
  return { execute: values.has('--execute') };
}

function uploadUrlFromPath(filePath) {
  const relative = path.relative(publicRoot, filePath);
  return '/' + relative.split(path.sep).map(encodeURIComponent).join('/');
}

function walk(root, result = []) {
  if (!fs.existsSync(root)) return result;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) walk(fullPath, result);
    else if (entry.isFile() && /\.(mp4|mov|m4v|avi|mkv|webm)$/i.test(entry.name)) result.push(fullPath);
  }
  return result;
}

const { execute } = args();
const files = walk(path.join(publicRoot, 'uploads'));
const find = db.prepare('SELECT id,name,vod_video_id FROM Material WHERE file_path=? OR file_url=? ORDER BY id');
const clear = db.prepare("UPDATE Material SET file_path='', file_url='', updated_at=datetime('now','localtime') WHERE id=?");

let deleted = 0;
let skipped = 0;
let bytes = 0;
for (const filePath of files) {
  const url = uploadUrlFromPath(filePath);
  const rows = find.all(url, url);
  const hasVod = rows.some(row => String(row.vod_video_id || '').trim());
  if (!hasVod) {
    skipped += 1;
    console.log(`SKIP_NO_VOD ${filePath}`);
    continue;
  }
  const size = fs.statSync(filePath).size;
  console.log(`DELETE ${filePath} rows=${rows.map(row => row.id).join(',')} bytes=${size}`);
  if (execute) {
    for (const row of rows) clear.run(row.id);
    fs.unlinkSync(filePath);
  }
  deleted += 1;
  bytes += size;
}

console.log(`${execute ? 'DONE' : 'PREVIEW'} deleted=${deleted} skipped=${skipped} bytes=${bytes} gib=${(bytes / 1024 / 1024 / 1024).toFixed(2)}`);
db.close();
