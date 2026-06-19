#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const Database = require('better-sqlite3');

const root = process.cwd();
const dbPath = path.join(root, 'admin.db');
const uploadRoot = path.join(root, 'public', 'uploads');

function stamp() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function ensureSchema(db) {
  const columns = db.prepare('PRAGMA table_info(Material)').all();
  if (!columns.some(column => column.name === 'file_hash')) {
    db.prepare("ALTER TABLE Material ADD COLUMN file_hash TEXT DEFAULT ''").run();
  }
  db.prepare("CREATE INDEX IF NOT EXISTS idx_material_file_hash ON Material(file_hash)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_material_type_size ON Material(type, file_size)").run();
}

function localPathFromUrl(value) {
  const text = String(value || '');
  if (!text.startsWith('/uploads/')) return null;
  let decoded = '';
  try {
    decoded = decodeURIComponent(text.replace(/^\/uploads\/+/, ''));
  } catch {
    return null;
  }
  const absolute = path.resolve(uploadRoot, decoded);
  if (!absolute.startsWith(path.resolve(uploadRoot) + path.sep)) return null;
  return absolute;
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    while (true) {
      const bytes = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (!bytes) break;
      hash.update(bytes === buffer.length ? buffer : buffer.subarray(0, bytes));
    }
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest('hex');
}

function materialFiles(row) {
  return [row.file_path, row.file_url, row.thumbnail]
    .map(localPathFromUrl)
    .filter(Boolean);
}

function unlinkUnusedFiles(row, keepRows) {
  const keepFiles = new Set(keepRows.flatMap(materialFiles).map(file => path.resolve(file)));
  for (const file of materialFiles(row)) {
    const resolved = path.resolve(file);
    if (keepFiles.has(resolved)) continue;
    try {
      fs.unlinkSync(resolved);
    } catch (err) {
      if (err && err.code !== 'ENOENT') {
        console.warn(`删除重复素材文件失败：${resolved} ${err.message || err}`);
      }
    }
  }
}

function score(row) {
  return Number(row.ref_count || 0) * 100000
    + (String(row.file_path || '').startsWith('/uploads/') ? 10000 : 0)
    + (String(row.vod_video_id || '').trim() ? 1000 : 0)
    + Number(row.id || 0) / 100000;
}

if (!fs.existsSync(dbPath)) {
  console.error(`找不到数据库：${dbPath}`);
  process.exit(1);
}

const backupPath = `/tmp/admin-db-before-material-hash-backfill-${stamp()}.db`;
fs.copyFileSync(dbPath, backupPath);

const db = new Database(dbPath);
const summary = {
  backup: backupPath,
  hashedRows: 0,
  missingFiles: 0,
  mergedRows: 0,
  movedReferences: 0,
  deletedDuplicateRows: [],
};

try {
  ensureSchema(db);
  const rows = db.prepare(`
    SELECT m.*,
      (SELECT COUNT(*) FROM CourseVideo cv WHERE cv.material_id=m.id) AS ref_count
    FROM Material m
    ORDER BY m.id
  `).all();
  const updateHash = db.prepare("UPDATE Material SET file_hash=?, updated_at=datetime('now','localtime') WHERE id=?");

  for (const row of rows) {
    if (String(row.file_hash || '').trim()) continue;
    const localPath = localPathFromUrl(row.file_path || row.file_url || '');
    if (!localPath || !fs.existsSync(localPath)) {
      summary.missingFiles += 1;
      continue;
    }
    const hash = sha256File(localPath);
    updateHash.run(hash, row.id);
    row.file_hash = hash;
    summary.hashedRows += 1;
  }

  const refreshed = db.prepare(`
    SELECT m.*,
      (SELECT COUNT(*) FROM CourseVideo cv WHERE cv.material_id=m.id) AS ref_count
    FROM Material m
    WHERE COALESCE(m.file_hash,'') != ''
    ORDER BY m.id
  `).all();
  const byHash = new Map();
  for (const row of refreshed) {
    const key = `${row.file_hash}\u0000${row.type || ''}\u0000${Number(row.file_size || 0)}`;
    if (!byHash.has(key)) byHash.set(key, []);
    byHash.get(key).push(row);
  }

  const mergeTx = db.transaction(() => {
    for (const group of byHash.values()) {
      if (group.length < 2) continue;
      const sorted = [...group].sort((a, b) => score(b) - score(a));
      const keeper = sorted[0];
      for (const loser of sorted.slice(1)) {
        const moved = db.prepare('UPDATE CourseVideo SET material_id=? WHERE material_id=?').run(keeper.id, loser.id).changes;
        summary.movedReferences += moved;
        const keeperFresh = db.prepare('SELECT * FROM Material WHERE id=?').get(keeper.id);
        const patch = {};
        if (!String(keeperFresh.vod_video_id || '').trim() && String(loser.vod_video_id || '').trim()) {
          patch.vod_video_id = loser.vod_video_id;
          patch.vod_media_id = loser.vod_media_id || loser.vod_video_id;
          patch.transcode_status = loser.transcode_status || keeperFresh.transcode_status || 'processing';
        }
        if (!String(keeperFresh.thumbnail || '').trim() && String(loser.thumbnail || '').trim()) {
          patch.thumbnail = loser.thumbnail;
        }
        if (Object.keys(patch).length) {
          const sets = Object.keys(patch).map(key => `${key}=?`).join(', ');
          db.prepare(`UPDATE Material SET ${sets}, updated_at=datetime('now','localtime') WHERE id=?`)
            .run(...Object.values(patch), keeper.id);
        }
        const refs = db.prepare('SELECT COUNT(*) AS count FROM CourseVideo WHERE material_id=?').get(keeper.id).count || 0;
        db.prepare("UPDATE Material SET is_referenced=?, updated_at=datetime('now','localtime') WHERE id=?").run(refs ? 1 : 0, keeper.id);
        db.prepare('DELETE FROM Material WHERE id=?').run(loser.id);
        unlinkUnusedFiles(loser, [keeper]);
        summary.deletedDuplicateRows.push({ deleted: loser.id, kept: keeper.id, name: loser.name });
        summary.mergedRows += 1;
      }
    }
  });
  mergeTx();

  const duplicates = db.prepare(`
    SELECT file_hash, type, file_size, COUNT(*) AS count, group_concat(id) AS ids
    FROM Material
    WHERE COALESCE(file_hash,'') != ''
    GROUP BY file_hash, type, file_size
    HAVING count > 1
  `).all();
  summary.remainingHashDuplicateGroups = duplicates.length;
  console.log(JSON.stringify(summary, null, 2));
} finally {
  db.close();
}
