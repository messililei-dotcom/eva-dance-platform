#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const path = require('path');
const Database = require('better-sqlite3');

const projectRoot = path.resolve(__dirname, '..');
loadEnvFile(path.join(projectRoot, '.env'));
loadEnvFile(path.join(projectRoot, '.env.production'));
loadEnvFile(path.join(projectRoot, '.env.local'));

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
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

function dbPath() {
  const configured = process.env.ADMIN_DB_PATH || process.env.UNIFIED_DB_PATH || 'admin.db';
  return path.isAbsolute(configured) ? configured : path.resolve(projectRoot, configured);
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
    ...params,
  };
  const canonicalizedQuery = Object.keys(allParams)
    .sort()
    .map(key => `${percentEncode(key)}=${percentEncode(allParams[key])}`)
    .join('&');
  const stringToSign = `POST&${percentEncode('/')}&${percentEncode(canonicalizedQuery)}`;
  const signature = crypto.createHmac('sha1', `${accessKeySecret}&`).update(stringToSign).digest('base64');
  return { ...allParams, Signature: signature };
}

function callVodRpc(action, params = {}) {
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
    }, res => {
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
    req.setTimeout(60000, () => req.destroy(new Error('VOD 请求超时')));
    req.write(body);
    req.end();
  });
}

function normalizeName(value) {
  return String(value || '')
    .normalize('NFC')
    .replace(/\.(mp4|mov|m4v|avi|mkv|webm)$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function basenameFromUrl(filePath) {
  const text = String(filePath || '');
  if (!text) return '';
  try {
    return decodeURIComponent(path.basename(text));
  } catch {
    return path.basename(text);
  }
}

function rowNames(row) {
  return Array.from(new Set([
    normalizeName(row.name),
    normalizeName(basenameFromUrl(row.file_path)),
    normalizeName(basenameFromUrl(row.file_url)),
  ].filter(Boolean)));
}

function localPathFromUploadUrl(value) {
  const text = String(value || '');
  if (!text) return '';
  const relative = text.replace(/^\/uploads\/+/, 'uploads/');
  try {
    return path.resolve(projectRoot, 'public', decodeURIComponent(relative));
  } catch {
    return path.resolve(projectRoot, 'public', relative);
  }
}

async function listVodVideos() {
  const pageSize = 100;
  const all = [];
  for (let page = 1; page <= 200; page += 1) {
    const response = await callVodRpc('GetVideoList', { PageNo: page, PageSize: pageSize });
    const list = response?.VideoList?.Video;
    const videos = Array.isArray(list) ? list : list ? [list] : [];
    for (const item of videos) {
      all.push({
        videoId: String(item.VideoId || '').trim(),
        title: String(item.Title || '').normalize('NFC').trim(),
        size: Number(item.Size || 0),
        status: String(item.Status || '').trim(),
        creationTime: String(item.CreationTime || '').trim(),
      });
    }
    const total = Number(response?.Total || response?.TotalCount || all.length);
    if (all.length >= total || videos.length < pageSize) break;
  }
  return all.filter(item => item.videoId);
}

async function deleteVod(videoId) {
  await callVodRpc('DeleteVideo', { VideoIds: videoId });
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

async function main() {
  const options = args();
  const execute = options.has('execute');
  const ids = String(options.get('ids') || '')
    .split(',')
    .map(value => Number(value.trim()))
    .filter(Boolean);
  if (!ids.length) throw new Error('请传入 --ids=1,2,3');

  const db = new Database(dbPath());
  const rows = db.prepare(`SELECT * FROM Material WHERE id IN (${ids.map(() => '?').join(',')}) ORDER BY id`).all(...ids);
  const vodVideos = await listVodVideos();
  const update = db.prepare("UPDATE Material SET vod_video_id=?, vod_media_id=?, transcode_status='processing', file_path='', file_url='', updated_at=datetime('now','localtime') WHERE id=?");
  const deleteLocal = [];
  const duplicateVodDeletes = [];

  for (const row of rows) {
    const names = rowNames(row);
    const matches = vodVideos.filter(video => names.includes(normalizeName(video.title)));
    const existing = matches.find(video => video.videoId && video.videoId !== row.vod_video_id);
    const current = row.vod_video_id ? matches.find(video => video.videoId === row.vod_video_id) : null;
    const chosen = existing || current || null;
    console.log(`#${row.id} ${row.name}`);
    console.log(`  names=${names.join(' | ') || '-'}`);
    console.log(`  current=${row.vod_video_id || '-'} matches=${matches.map(video => `${video.videoId}:${video.title}`).join(' ; ') || '-'}`);
    if (!chosen) {
      console.log('  action=NO_MATCH_KEEP_LOCAL_FOR_UPLOAD');
      continue;
    }
    if (row.vod_video_id && existing && row.vod_video_id !== existing.videoId) {
      duplicateVodDeletes.push(row.vod_video_id);
    }
    console.log(`  action=BIND_EXISTING_VOD_AND_DELETE_LOCAL chosen=${chosen.videoId}`);
    if (execute) update.run(chosen.videoId, chosen.videoId, row.id);
    const paths = [row.file_path, row.file_url]
      .filter(Boolean)
      .map(localPathFromUploadUrl);
    for (const filePath of paths) {
      if (fs.existsSync(filePath)) deleteLocal.push(filePath);
    }
  }

  if (execute) {
    for (const videoId of Array.from(new Set(duplicateVodDeletes))) {
      console.log(`DELETE_DUPLICATE_VOD ${videoId}`);
      await deleteVod(videoId);
    }
    for (const filePath of Array.from(new Set(deleteLocal))) {
      console.log(`DELETE_LOCAL ${filePath}`);
      fs.unlinkSync(filePath);
    }
  } else {
    console.log('预览完成。执行请加 --execute');
  }
  db.close();
}

main().catch(err => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
