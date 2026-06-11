#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const PUBLIC_UPLOAD_ROOT = path.join(projectRoot, 'public', 'uploads');
const DEFAULT_SCAN_ROOT = path.join(PUBLIC_UPLOAD_ROOT, 'online-course', 'course-content', 'material-center');

function args() {
  const values = new Map();
  for (const item of process.argv.slice(2)) {
    if (item.startsWith('--') && item.includes('=')) {
      const [key, value] = item.slice(2).split(/=(.*)/s);
      values.set(key, value);
    } else if (item.startsWith('--')) {
      values.set(item.slice(2), true);
    }
  }
  return values;
}

function getBetterSqlite3() {
  try {
    return require('better-sqlite3');
  } catch {
    return require(path.resolve(projectRoot, '../03-学员管理系统/学员管理系统/server/node_modules/better-sqlite3'));
  }
}

function dbPath() {
  const configured = process.env.ADMIN_DB_PATH || process.env.UNIFIED_DB_PATH || 'admin.db';
  return path.isAbsolute(configured) ? configured : path.resolve(projectRoot, configured);
}

function cleanText(value, fallback = '') {
  const text = String(value || '').normalize('NFC').trim();
  return text || fallback;
}

function stripCopySuffix(name) {
  return name.replace(/\s+\(\d+\)(?=\.[^.]+$)/, '');
}

function matchKey(name) {
  return stripCopySuffix(path.basename(cleanText(name))).normalize('NFC').toLowerCase();
}

function walkFiles(root, result = []) {
  if (!root || !fs.existsSync(root)) return result;
  const stat = fs.statSync(root);
  if (stat.isFile()) {
    result.push(root);
    return result;
  }
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, result);
    } else if (entry.isFile()) {
      result.push(fullPath);
    }
  }
  return result;
}

function isVideo(filePath) {
  return ['.mp4', '.mov', '.m4v', '.avi', '.mkv', '.webm'].includes(path.extname(filePath).toLowerCase());
}

function uploadUrlFor(filePath) {
  const absolute = path.resolve(filePath);
  const uploadRoot = path.resolve(PUBLIC_UPLOAD_ROOT);
  if (!absolute.startsWith(uploadRoot + path.sep)) return '';
  const relative = path.relative(uploadRoot, absolute).split(path.sep).map(encodeURIComponent).join('/');
  return `/uploads/${relative}`;
}

function localPathForUrl(fileUrl) {
  const text = cleanText(fileUrl);
  if (!text.startsWith('/uploads/')) return '';
  const relative = decodeURIComponent(text.replace(/^\/uploads\/+/, ''));
  return path.resolve(PUBLIC_UPLOAD_ROOT, relative);
}

function indexScannedVideos(scanRoot) {
  const files = walkFiles(scanRoot).filter(isVideo);
  const byKey = new Map();
  const duplicates = new Map();
  for (const filePath of files) {
    const key = matchKey(path.basename(filePath));
    if (byKey.has(key)) {
      duplicates.set(key, [...(duplicates.get(key) || [byKey.get(key)]), filePath]);
      continue;
    }
    byKey.set(key, filePath);
  }
  return { files, byKey, duplicates };
}

function main() {
  const options = args();
  const execute = options.has('execute');
  const scanRoot = path.resolve(cleanText(options.get('scan-root'), DEFAULT_SCAN_ROOT));
  const db = new (getBetterSqlite3())(dbPath());
  const rows = db.prepare("SELECT * FROM Material WHERE type='video' ORDER BY id").all();
  const { files, byKey, duplicates } = indexScannedVideos(scanRoot);

  console.log(`扫描目录：${scanRoot}`);
  console.log(`扫描到视频文件：${files.length}`);
  console.log(`数据库视频素材：${rows.length}`);
  if (duplicates.size) {
    console.log(`重复文件名：${duplicates.size} 个，重复项不会自动匹配`);
  }

  const matched = [];
  const missing = [];
  for (const row of rows) {
    const key = matchKey(row.name);
    const filePath = duplicates.has(key) ? '' : byKey.get(key);
    if (!filePath) {
      missing.push(row);
      continue;
    }
    const fileUrl = uploadUrlFor(filePath);
    if (!fileUrl) {
      missing.push(row);
      continue;
    }
    const currentPath = localPathForUrl(row.file_path || row.file_url);
    matched.push({
      row,
      filePath,
      fileUrl,
      size: fs.statSync(filePath).size,
      changed: path.resolve(currentPath || '') !== path.resolve(filePath),
    });
  }

  console.log(`可匹配素材：${matched.length}`);
  console.log(`未匹配素材：${missing.length}`);
  matched.forEach(item => {
    console.log(`${item.changed ? 'CHANGE' : 'SAME'} #${item.row.id} ${item.row.name} -> ${item.fileUrl}`);
  });
  missing.forEach(row => {
    console.log(`MISS #${row.id} ${row.name}`);
  });

  if (!execute) {
    console.log('\n预览完成。确认匹配正确后加 --execute 回填新路径。');
    db.close();
    return;
  }

  const stmt = db.prepare(`
    UPDATE Material
    SET file_path=?, file_url=?, file_size=?, updated_at=datetime('now','localtime')
    WHERE id=?
  `);
  const tx = db.transaction((items) => {
    for (const item of items) stmt.run(item.fileUrl, item.fileUrl, item.size, item.row.id);
  });
  tx(matched);
  console.log(`\n已回填新路径：${matched.length} 条`);
  db.close();
}

main();
