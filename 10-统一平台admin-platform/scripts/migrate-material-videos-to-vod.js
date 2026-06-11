#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const MATERIAL_UPLOAD_ROOT = path.join(projectRoot, 'public', 'uploads');
const LEGACY_MATERIAL_ROOT = path.join(projectRoot, 'uploads', 'materials');

loadEnvFile(path.join(projectRoot, '.env'));
loadEnvFile(path.join(projectRoot, '.env.production'));
loadEnvFile(path.join(projectRoot, '.env.local'));

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const index = trimmed.indexOf('=');
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

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

function localMaterialPath(filePath) {
  const text = String(filePath || '');
  if (!text) return null;
  let absolutePath = '';
  if (text.startsWith('/uploads/materials/')) {
    const decoded = decodeURIComponent(text.replace(/^\/uploads\/materials\/+/, ''));
    absolutePath = path.resolve(LEGACY_MATERIAL_ROOT, decoded);
    if (!absolutePath.startsWith(path.resolve(LEGACY_MATERIAL_ROOT) + path.sep)) return null;
  } else if (text.startsWith('/uploads/')) {
    const decoded = decodeURIComponent(text.replace(/^\/uploads\/+/, ''));
    absolutePath = path.resolve(MATERIAL_UPLOAD_ROOT, decoded);
    if (!absolutePath.startsWith(path.resolve(MATERIAL_UPLOAD_ROOT) + path.sep)) return null;
  } else if (path.isAbsolute(text)) {
    absolutePath = path.resolve(text);
  } else {
    return null;
  }
  return absolutePath;
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
    if (entry.isDirectory()) walkFiles(fullPath, result);
    else if (entry.isFile()) result.push(fullPath);
  }
  return result;
}

function buildSourceIndex(sourceRoot) {
  if (!sourceRoot) return null;
  const root = path.resolve(sourceRoot);
  if (!fs.existsSync(root)) throw new Error(`源视频目录不存在：${root}`);
  const index = new Map();
  for (const filePath of walkFiles(root)) {
    const ext = path.extname(filePath).toLowerCase();
    if (!['.mp4', '.mov', '.m4v', '.avi', '.mkv', '.webm'].includes(ext)) continue;
    const name = path.basename(filePath).normalize('NFC');
    if (!index.has(name)) index.set(name, filePath);
  }
  return index;
}

function sourceFileForRow(row, sourceIndex) {
  const current = localMaterialPath(row.file_path || row.file_url);
  if (current && fs.existsSync(current)) return current;
  if (!sourceIndex) return current;

  const names = [
    cleanText(row.name),
    cleanText(path.basename(decodeURIComponent(row.file_path || row.file_url || ''))),
  ].filter(Boolean).map(value => value.normalize('NFC'));

  for (const name of names) {
    const found = sourceIndex.get(name);
    if (found) return found;
  }
  return current;
}

function vodRegion() {
  return process.env.ALIYUN_VOD_REGION || 'cn-shenzhen';
}

function percentEncode(value) {
  return encodeURIComponent(value)
    .replace(/\+/g, '%20')
    .replace(/\*/g, '%2A')
    .replace(/%7E/g, '~');
}

function signedRpcParams(action, params) {
  const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID || '';
  const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET || '';
  if (!accessKeyId || !accessKeySecret) throw new Error('阿里云 AccessKey 未配置');

  const allParams = {
    Action: action,
    Version: '2017-03-21',
    Format: 'JSON',
    SignatureMethod: 'HMAC-SHA1',
    SignatureNonce: `${Date.now()}${Math.random()}`,
    SignatureVersion: '1.0',
    AccessKeyId: accessKeyId,
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    RegionId: vodRegion(),
  };
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') allParams[key] = String(value);
  });

  const canonicalizedQuery = Object.keys(allParams)
    .sort()
    .map(key => `${percentEncode(key)}=${percentEncode(allParams[key])}`)
    .join('&');
  const stringToSign = `POST&${percentEncode('/')}&${percentEncode(canonicalizedQuery)}`;
  const signature = crypto.createHmac('sha1', `${accessKeySecret}&`).update(stringToSign).digest('base64');
  return { ...allParams, Signature: signature };
}

function callVodRpc(action, params) {
  const body = new URLSearchParams(signedRpcParams(action, params)).toString();
  const hostname = `vod.${vodRegion()}.aliyuncs.com`;

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let parsed;
        try {
          parsed = JSON.parse(data || '{}');
        } catch {
          reject(new Error(`VOD 响应解析失败：${data.slice(0, 200)}`));
          return;
        }
        if (res.statusCode >= 400 || (parsed.Code && parsed.Code !== 'OK')) {
          reject(new Error(parsed.Message || parsed.Code || `VOD 请求失败 (${res.statusCode})`));
          return;
        }
        resolve(parsed);
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function decodeVodBase64(value) {
  return JSON.parse(Buffer.from(value, 'base64').toString('utf8'));
}

function ossObjectUrl(endpoint, bucket, objectName) {
  const cleanedEndpoint = endpoint.replace(/^https?:\/\//, '');
  return `https://${bucket}.${cleanedEndpoint}/${objectName.split('/').map(percentEncode).join('/')}`;
}

function signOssPut(auth, bucket, objectName, date, contentType) {
  if (!auth.AccessKeyId || !auth.AccessKeySecret) throw new Error('VOD 上传凭证缺少 AccessKey');
  const tokenHeader = auth.SecurityToken ? `x-oss-security-token:${auth.SecurityToken}\n` : '';
  const stringToSign = ['PUT', '', contentType, date, `${tokenHeader}/${bucket}/${objectName}`].join('\n');
  const signature = crypto.createHmac('sha1', auth.AccessKeySecret).update(stringToSign).digest('base64');
  return `OSS ${auth.AccessKeyId}:${signature}`;
}

function putObject(filePath, uploadAddress, uploadAuth) {
  const endpoint = uploadAddress.Endpoint || '';
  const bucket = uploadAddress.Bucket || '';
  const objectName = uploadAddress.FileName || '';
  if (!endpoint || !bucket || !objectName) throw new Error('VOD 上传地址缺少 Endpoint/Bucket/FileName');

  const stat = fs.statSync(filePath);
  const date = new Date().toUTCString();
  const contentType = 'application/octet-stream';
  const url = new URL(ossObjectUrl(endpoint, bucket, objectName));

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'PUT',
      headers: {
        Authorization: signOssPut(uploadAuth, bucket, objectName, date, contentType),
        Date: date,
        'Content-Type': contentType,
        'Content-Length': stat.size,
        ...(uploadAuth.SecurityToken ? { 'x-oss-security-token': uploadAuth.SecurityToken } : {}),
      },
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`OSS 上传失败 (${res.statusCode})：${data.slice(0, 300)}`));
          return;
        }
        resolve({ endpoint, bucket, objectName });
      });
    });
    req.on('error', reject);
    fs.createReadStream(filePath).on('error', reject).pipe(req);
  });
}

function titleForVod(name) {
  const base = path.basename(name, path.extname(name)).trim() || '素材视频';
  return Array.from(base).slice(0, 128).join('');
}

async function uploadVideo(row, filePath) {
  const response = await callVodRpc('CreateUploadVideo', {
    Title: titleForVod(row.name),
    FileName: row.name || path.basename(filePath),
    FileSize: row.file_size || fs.statSync(filePath).size,
    Description: `material_id=${row.id}; folder_id=${row.folder_id || 0}`,
    StorageLocation: process.env.ALIYUN_VOD_STORAGE_LOCATION,
    AppId: process.env.ALIYUN_VOD_APP_ID,
    TemplateGroupId: process.env.ALIYUN_VOD_TEMPLATE_GROUP_ID,
  });
  if (!response.VideoId || !response.UploadAddress || !response.UploadAuth) {
    throw new Error('VOD 未返回完整上传凭证');
  }
  const uploadAddress = decodeVodBase64(response.UploadAddress);
  const uploadAuth = decodeVodBase64(response.UploadAuth);
  const uploaded = await putObject(filePath, uploadAddress, uploadAuth);
  return { videoId: response.VideoId, ...uploaded };
}

function selectedRows(db, options) {
  const ids = cleanText(options.get('ids'));
  const names = cleanText(options.get('names'));
  const force = options.has('force');
  const limit = Number(options.get('limit') || 0);
  const params = [];
  let where = "WHERE type='video'";
  if (!force) where += " AND COALESCE(vod_video_id,'')=''";
  if (ids) {
    const list = ids.split(',').map(value => Number(value.trim())).filter(Boolean);
    if (list.length) {
      where += ` AND id IN (${list.map(() => '?').join(',')})`;
      params.push(...list);
    }
  }
  if (names) {
    const list = names.split(',').map(value => value.trim()).filter(Boolean);
    if (list.length) {
      where += ` AND name IN (${list.map(() => '?').join(',')})`;
      params.push(...list);
    }
  }
  let sql = `SELECT * FROM Material ${where} ORDER BY id`;
  if (Number.isInteger(limit) && limit > 0) sql += ` LIMIT ${limit}`;
  return db.prepare(sql).all(...params);
}

async function main() {
  const options = args();
  const execute = options.has('execute');
  const db = new (getBetterSqlite3())(dbPath());
  const sourceIndex = buildSourceIndex(cleanText(options.get('source-root')));
  const rows = selectedRows(db, options);
  const candidates = rows.map(row => {
    const filePath = sourceFileForRow(row, sourceIndex);
    const exists = Boolean(filePath && fs.existsSync(filePath));
    return { row, filePath, exists };
  });

  console.log(`待处理视频素材：${candidates.length}`);
  candidates.forEach(({ row, filePath, exists }) => {
    console.log(`${exists ? 'OK' : 'MISS'} #${row.id} ${row.name} -> ${filePath || row.file_path || row.file_url || '-'}`);
  });

  if (!execute) {
    console.log('\n预览完成。真正上传请加 --execute。可用 --limit=1、--ids=274,275、--names=空间维度.mov,空间点位.mp4 或 --source-root=/path/to/videos 控制范围。');
    db.close();
    return;
  }

  if (!process.env.ALIYUN_ACCESS_KEY_ID || !process.env.ALIYUN_ACCESS_KEY_SECRET) {
    throw new Error('缺少 ALIYUN_ACCESS_KEY_ID / ALIYUN_ACCESS_KEY_SECRET');
  }

  const updateStmt = db.prepare(`
    UPDATE Material
    SET vod_video_id=?, vod_media_id=?, transcode_status='processing', updated_at=datetime('now','localtime')
    WHERE id=?
  `);

  let success = 0;
  let failed = 0;
  for (const item of candidates) {
    const { row, filePath, exists } = item;
    if (!exists) {
      failed += 1;
      console.error(`跳过 #${row.id}：本地文件不存在`);
      continue;
    }
    try {
      console.log(`\n上传 #${row.id} ${row.name}`);
      const result = await uploadVideo(row, filePath);
      updateStmt.run(result.videoId, result.videoId, row.id);
      success += 1;
      console.log(`完成 #${row.id} VideoId=${result.videoId} OSS=${result.bucket}/${result.objectName}`);
    } catch (err) {
      failed += 1;
      console.error(`失败 #${row.id}：${err && err.message ? err.message : err}`);
    }
  }

  console.log(`\n迁移完成：成功 ${success}，失败 ${failed}`);
  db.close();
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
