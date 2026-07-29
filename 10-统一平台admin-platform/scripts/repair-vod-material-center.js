#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const path = require('path');
const Database = require('better-sqlite3');

const projectRoot = path.resolve(__dirname, '..');

for (const name of ['.env', '.env.production', '.env.local']) {
  loadEnvFile(path.join(projectRoot, name));
}

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
    .map(key => `${percentEncode(key)}=${percentEncode(String(allParams[key]))}`)
    .join('&');
  const stringToSign = `POST&${percentEncode('/')}&${percentEncode(canonicalizedQuery)}`;
  const signature = crypto.createHmac('sha1', `${accessKeySecret}&`).update(stringToSign).digest('base64');
  return { ...allParams, Signature: signature };
}

function callVodRpc(action, params = {}) {
  const body = new URLSearchParams(signedRpcParams(action, params)).toString();
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: `vod.${vodRegion()}.aliyuncs.com`,
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
        if ((res.statusCode || 0) >= 400 || (parsed.Code && parsed.Code !== 'OK')) {
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

async function listVodVideos() {
  const all = [];
  for (let page = 1; page <= 100; page += 1) {
    const response = await callVodRpc('GetVideoList', { PageNo: page, PageSize: 100 });
    const raw = response?.VideoList?.Video;
    const videos = Array.isArray(raw) ? raw : raw ? [raw] : [];
    for (const item of videos) {
      all.push({
        videoId: String(item.VideoId || '').trim(),
        title: String(item.Title || '').trim(),
        status: String(item.Status || '').trim(),
        coverUrl: String(item.CoverURL || item.CoverUrl || '').trim(),
        duration: Number(item.Duration || 0),
        size: Number(item.Size || 0),
      });
    }
    const total = Number(response?.Total || response?.TotalCount || 0);
    if (all.length >= total || videos.length < 100) break;
  }
  return all.filter(video => video.videoId);
}

function cleanText(value, fallback = '') {
  const text = String(value ?? '').normalize('NFC').trim();
  return text || fallback;
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

function materialNameFromVod(video) {
  const title = cleanText(decodePossiblyMojibake(video.title), `VOD-${video.videoId}`);
  return title.length > 180 ? `${title.slice(0, 170)}-${video.videoId.slice(0, 8)}` : title;
}

function comparableMaterialName(value) {
  return cleanText(decodePossiblyMojibake(value))
    .replace(/\.[a-z0-9]{1,8}$/i, '')
    .toLowerCase();
}

function statusFromVodStatus(status) {
  if (status === 'Normal') return 'success';
  if (['UploadFail', 'TranscodeFail', 'Blocked'].includes(status)) return 'failed';
  return 'processing';
}

function ensureDefaultFolder(db) {
  const row = db.prepare("SELECT id FROM MaterialFolder WHERE parent_id=0 AND name='默认素材' LIMIT 1").get();
  if (row) return Number(row.id);
  return Number(db.prepare("INSERT INTO MaterialFolder (name, parent_id, sort_order) VALUES ('默认素材', 0, 0)").run().lastInsertRowid);
}

function materialCounts(db) {
  return {
    total: db.prepare('SELECT COUNT(*) AS count FROM Material').get().count,
    video: db.prepare("SELECT COUNT(*) AS count FROM Material WHERE type='video'").get().count,
    vodRows: db.prepare("SELECT COUNT(*) AS count FROM Material WHERE COALESCE(vod_video_id,'')!=''").get().count,
    vodDistinct: db.prepare("SELECT COUNT(DISTINCT vod_video_id) AS count FROM Material WHERE COALESCE(vod_video_id,'')!=''").get().count,
    duplicateGroups: db.prepare("SELECT COUNT(*) AS count FROM (SELECT vod_video_id FROM Material WHERE COALESCE(vod_video_id,'')!='' GROUP BY vod_video_id HAVING COUNT(*)>1)").get().count,
    unboundVideo: db.prepare("SELECT COUNT(*) AS count FROM Material WHERE type='video' AND COALESCE(vod_video_id,'')=''").get().count,
  };
}

function repairMaterialCenter(db, vodVideos) {
  const vodIds = new Set(vodVideos.map(video => video.videoId));
  const defaultFolderId = ensureDefaultFolder(db);
  const beforeDbIds = new Set(db.prepare("SELECT DISTINCT vod_video_id FROM Material WHERE COALESCE(vod_video_id,'')!=''")
    .all()
    .map(row => String(row.vod_video_id || '').trim())
    .filter(Boolean));

  const claimStmt = db.prepare(`
    UPDATE Material
    SET name=?,
        vod_video_id=?,
        vod_media_id=?,
        file_path=CASE WHEN COALESCE(file_path,'')='' THEN ? ELSE file_path END,
        file_size=?,
        duration=?,
        thumbnail=COALESCE(NULLIF(thumbnail,''), ?),
        transcode_status=?,
        updated_at=datetime('now','localtime')
    WHERE id=?
  `);
  const insertStmt = db.prepare(`
    INSERT INTO Material (
      name, type, folder_id, file_path, file_url, file_size,
      duration, thumbnail, transcode_status, risk_status, is_referenced,
      vod_media_id, vod_video_id, uploaded_by, created_at, updated_at
    )
    VALUES (?, 'video', ?, ?, '', ?, ?, ?, ?, 'passed', 0, ?, ?, 0,
      datetime('now','localtime'), datetime('now','localtime'))
  `);

  let claimed = 0;
  let inserted = 0;
  let staleDeleted = 0;
  let staleMarked = 0;
  let duplicatesDeleted = 0;
  let referencesMoved = 0;
  let placeholdersMerged = 0;

  for (const video of vodVideos.filter(item => !beforeDbIds.has(item.videoId))) {
    const name = materialNameFromVod(video);
    const targetName = comparableMaterialName(name);
    const videoSize = Math.max(0, Math.floor(video.size || 0));
    const candidates = db.prepare(`
      SELECT id, name, file_size, file_path, file_url
      FROM Material
      WHERE type='video' AND COALESCE(vod_video_id,'')=''
      ORDER BY is_referenced DESC, id DESC
    `).all();
    const match = candidates.find(row => (
      comparableMaterialName(row.name || '') === targetName
      && (
        (videoSize && Math.max(0, Math.floor(Number(row.file_size || 0))) === videoSize)
        || (!Number(row.file_size || 0) && !String(row.file_path || row.file_url || '').trim())
      )
    ));
    const status = statusFromVodStatus(video.status);
    if (match) {
      claimStmt.run(
        name,
        video.videoId,
        video.videoId,
        `vod:${video.videoId}`,
        videoSize,
        Math.max(0, Math.round(video.duration || 0)),
        video.coverUrl || '',
        status,
        match.id,
      );
      claimed += 1;
    } else {
      insertStmt.run(
        name,
        defaultFolderId,
        `vod:${video.videoId}`,
        videoSize,
        Math.max(0, Math.round(video.duration || 0)),
        video.coverUrl || '',
        status,
        video.videoId,
        video.videoId,
      );
      inserted += 1;
    }
  }

  const staleRows = db.prepare("SELECT id, vod_video_id FROM Material WHERE COALESCE(vod_video_id,'')!=''")
    .all()
    .filter(row => !vodIds.has(String(row.vod_video_id || '').trim()));
  for (const row of staleRows) {
    const refs = Number(db.prepare('SELECT COUNT(*) AS count FROM CourseVideo WHERE material_id=?').get(row.id).count || 0);
    if (refs > 0) {
      db.prepare("UPDATE Material SET vod_video_id='', vod_media_id='', transcode_status='failed', updated_at=datetime('now','localtime') WHERE id=?").run(row.id);
      staleMarked += 1;
    } else {
      db.prepare('DELETE FROM Material WHERE id=?').run(row.id);
      staleDeleted += 1;
    }
  }

  const duplicateGroups = db.prepare(`
    SELECT vod_video_id, GROUP_CONCAT(id) AS ids
    FROM Material
    WHERE COALESCE(vod_video_id,'')!=''
    GROUP BY vod_video_id
    HAVING COUNT(*)>1
  `).all();
  for (const group of duplicateGroups) {
    const ids = String(group.ids || '').split(',').map(Number).filter(Boolean);
    const rows = db.prepare(`
      SELECT m.id, m.file_path, m.file_url,
             (SELECT COUNT(*) FROM CourseVideo cv WHERE cv.material_id=m.id) AS refs
      FROM Material m
      WHERE m.id IN (${ids.map(() => '?').join(',')})
    `).all(...ids).sort((left, right) => {
      const leftVodPath = String(left.file_path || left.file_url || '').startsWith('vod:') ? 1 : 0;
      const rightVodPath = String(right.file_path || right.file_url || '').startsWith('vod:') ? 1 : 0;
      return rightVodPath - leftVodPath || Number(right.refs || 0) - Number(left.refs || 0) || Number(right.id) - Number(left.id);
    });
    const keep = rows[0];
    for (const loser of rows.slice(1)) {
      referencesMoved += db.prepare('UPDATE CourseVideo SET material_id=? WHERE material_id=?').run(keep.id, loser.id).changes;
      db.prepare('DELETE FROM Material WHERE id=?').run(loser.id);
      duplicatesDeleted += 1;
    }
  }

  const boundRows = db.prepare("SELECT id, name FROM Material WHERE type='video' AND COALESCE(vod_video_id,'')!=''").all();
  const boundByName = new Map();
  for (const row of boundRows) {
    const key = comparableMaterialName(row.name);
    if (!boundByName.has(key)) boundByName.set(key, row.id);
  }
  const unboundRows = db.prepare("SELECT id, name FROM Material WHERE type='video' AND COALESCE(vod_video_id,'')=''").all();
  for (const row of unboundRows) {
    const targetId = boundByName.get(comparableMaterialName(row.name));
    if (!targetId) continue;
    referencesMoved += db.prepare('UPDATE CourseVideo SET material_id=? WHERE material_id=?').run(targetId, row.id).changes;
    db.prepare('DELETE FROM Material WHERE id=?').run(row.id);
    placeholdersMerged += 1;
  }

  db.prepare(`
    UPDATE Material
    SET is_referenced=CASE WHEN EXISTS (SELECT 1 FROM CourseVideo cv WHERE cv.material_id=Material.id) THEN 1 ELSE 0 END,
        updated_at=datetime('now','localtime')
    WHERE type='video'
  `).run();

  return { claimed, inserted, staleDeleted, staleMarked, duplicatesDeleted, referencesMoved, placeholdersMerged };
}

async function main() {
  const execute = process.argv.includes('--execute');
  const db = new Database(dbPath());
  const vodVideos = await listVodVideos();
  const before = materialCounts(db);

  let result = { claimed: 0, inserted: 0, staleDeleted: 0, staleMarked: 0, duplicatesDeleted: 0, referencesMoved: 0, placeholdersMerged: 0 };
  if (execute) {
    result = db.transaction(() => repairMaterialCenter(db, vodVideos))();
  }

  const after = materialCounts(db);
  const dbVodIds = new Set(db.prepare("SELECT DISTINCT vod_video_id FROM Material WHERE type='video' AND COALESCE(vod_video_id,'')!=''")
    .all()
    .map(row => String(row.vod_video_id || '').trim())
    .filter(Boolean));
  const vodIds = new Set(vodVideos.map(video => video.videoId));
  const finalCheck = {
    vodTotal: vodVideos.length,
    missingFromPlatform: vodVideos.filter(video => !dbVodIds.has(video.videoId)).length,
    staleInPlatform: Array.from(dbVodIds).filter(id => !vodIds.has(id)).length,
  };

  console.log(JSON.stringify({
    execute,
    before,
    result,
    after,
    finalCheck,
  }, null, 2));
  db.close();
}

main().catch(err => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
