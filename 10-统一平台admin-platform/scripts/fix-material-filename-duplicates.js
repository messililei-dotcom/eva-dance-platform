#!/usr/bin/env node
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

function decodePossiblyMojibake(value) {
  const text = String(value || '');
  if (!text || !/[ÃÂãåèçæéïð]/.test(text)) return text;
  try {
    const decoded = Buffer.from(text, 'latin1').toString('utf8');
    if (decoded && !decoded.includes('�')) return decoded;
  } catch {}
  return text;
}

function safeName(value, fallback = `material-${Date.now()}`) {
  const cleaned = String(value || fallback)
    .normalize('NFC')
    .trim()
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '');
  return cleaned || fallback;
}

function comparableName(value) {
  return safeName(decodePossiblyMojibake(value || ''), '')
    .replace(/\.[a-z0-9]{1,8}$/i, '')
    .toLowerCase();
}

function duplicateKey(row) {
  return `${comparableName(row.name)}\u0000${row.type || ''}\u0000${Number(row.file_size || 0)}`;
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

function uploadUrlForPath(absolutePath) {
  const rel = path.relative(uploadRoot, absolutePath);
  if (!rel || rel.startsWith('..')) return '';
  return '/uploads/' + rel.split(path.sep).map(encodeURIComponent).join('/');
}

function renameDecodedFile(urlValue) {
  const oldPath = localPathFromUrl(urlValue);
  if (!oldPath) return { url: urlValue || '', renamed: false };
  const oldBase = path.basename(oldPath);
  const decodedBase = safeName(decodePossiblyMojibake(oldBase), oldBase);
  if (!decodedBase || decodedBase === oldBase) return { url: uploadUrlForPath(oldPath) || urlValue || '', renamed: false };

  let nextPath = path.join(path.dirname(oldPath), decodedBase);
  const parsed = path.parse(decodedBase);
  let index = 1;
  while (fs.existsSync(nextPath) && path.resolve(nextPath) !== path.resolve(oldPath)) {
    nextPath = path.join(path.dirname(oldPath), `${parsed.name} (${index})${parsed.ext}`);
    index += 1;
  }
  if (fs.existsSync(oldPath) && path.resolve(nextPath) !== path.resolve(oldPath)) {
    fs.renameSync(oldPath, nextPath);
    return { url: uploadUrlForPath(nextPath), renamed: true };
  }
  return { url: uploadUrlForPath(nextPath) || urlValue || '', renamed: false };
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
    + (!/[ÃÂãåèçæéïð]/.test(String(row.name || '')) ? 100 : 0)
    + Number(row.id || 0) / 100000;
}

if (!fs.existsSync(dbPath)) {
  console.error(`找不到数据库：${dbPath}`);
  process.exit(1);
}

const backupPath = `/tmp/admin-db-before-material-name-fix-${stamp()}.db`;
fs.copyFileSync(dbPath, backupPath);

const db = new Database(dbPath);
const summary = {
  backup: backupPath,
  renamedFiles: 0,
  renamedRows: 0,
  mergedRows: 0,
  movedReferences: 0,
  updatedVodLinks: 0,
  deletedDuplicateRows: [],
};

try {
  const rows = db.prepare(`
    SELECT m.*,
      (SELECT COUNT(*) FROM CourseVideo cv WHERE cv.material_id=m.id) AS ref_count
    FROM Material m
    ORDER BY m.id
  `).all();

  const updateNameAndPaths = db.prepare(`
    UPDATE Material
    SET name=?, file_path=?, file_url=?, thumbnail=?, updated_at=datetime('now','localtime')
    WHERE id=?
  `);

  const normalizedRows = [];
  const normalizeTx = db.transaction(() => {
    for (const row of rows) {
      const nextName = safeName(decodePossiblyMojibake(row.name || ''), row.name || `material-${row.id}`);
      const filePath = renameDecodedFile(row.file_path || '');
      const fileUrl = renameDecodedFile(row.file_url || '');
      const thumb = renameDecodedFile(row.thumbnail || '');
      const changed = nextName !== row.name
        || filePath.url !== (row.file_path || '')
        || fileUrl.url !== (row.file_url || '')
        || thumb.url !== (row.thumbnail || '');
      const nextRow = {
        ...row,
        name: nextName,
        file_path: filePath.url || row.file_path || '',
        file_url: fileUrl.url || row.file_url || '',
        thumbnail: thumb.url || row.thumbnail || '',
      };
      normalizedRows.push(nextRow);
      if (filePath.renamed || fileUrl.renamed || thumb.renamed) summary.renamedFiles += 1;
      if (changed) {
        updateNameAndPaths.run(nextRow.name, nextRow.file_path, nextRow.file_url, nextRow.thumbnail, row.id);
        summary.renamedRows += 1;
      }
    }
  });
  normalizeTx();

  const byKey = new Map();
  for (const row of normalizedRows) {
    const key = duplicateKey(row);
    if (!key.startsWith('\u0000') && Number(row.file_size || 0) > 0) {
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(row);
    }
  }

  const mergeTx = db.transaction(() => {
    for (const group of byKey.values()) {
      if (group.length < 2) continue;
      const sorted = [...group].sort((a, b) => score(b) - score(a));
      const keeper = sorted[0];
      const losers = sorted.slice(1);
      for (const loser of losers) {
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
          if (patch.vod_video_id) summary.updatedVodLinks += 1;
        }

        const refCount = db.prepare('SELECT COUNT(*) AS count FROM CourseVideo WHERE material_id=?').get(keeper.id).count || 0;
        db.prepare('UPDATE Material SET is_referenced=?, updated_at=datetime(\'now\',\'localtime\') WHERE id=?').run(refCount ? 1 : 0, keeper.id);
        db.prepare('DELETE FROM Material WHERE id=?').run(loser.id);
        summary.deletedDuplicateRows.push({ deleted: loser.id, kept: keeper.id, name: loser.name });
        summary.mergedRows += 1;
        unlinkUnusedFiles(loser, [keeper]);
      }
    }
  });
  mergeTx();

  const repairCourseVideoNames = db.prepare(`
    UPDATE CourseVideo
    SET name=(
      SELECT Material.name FROM Material WHERE Material.id=CourseVideo.material_id
    )
    WHERE material_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM Material WHERE Material.id=CourseVideo.material_id)
      AND (name GLOB '*Ã*' OR name GLOB '*ã*' OR name GLOB '*å*' OR name GLOB '*è*')
  `).run();
  summary.repairedCourseVideoNames = repairCourseVideoNames.changes || 0;

  const badRows = db.prepare(`
    SELECT COUNT(*) AS count
    FROM Material
    WHERE name GLOB '*Ã*' OR name GLOB '*ã*' OR name GLOB '*å*' OR name GLOB '*è*'
  `).get();
  summary.remainingLikelyMojibakeRows = badRows.count || 0;

  console.log(JSON.stringify(summary, null, 2));
} finally {
  db.close();
}
