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

async function audit() {
 const db = new Database(dbPath(), {readonly:true});
 const materials=db.prepare("SELECT * FROM Material WHERE type='video'").all();
 const lessons=db.prepare(`SELECT cv.*, oc.name course_name, cs.name series_name FROM CourseVideo cv LEFT JOIN OnlineCourse oc ON oc.id=cv.course_id LEFT JOIN CourseSeries cs ON cs.id=oc.series_id`).all();
 const videos=await listVodVideos();
 const results=[]; let cursor=0;
 async function worker(){while(cursor<materials.length){const m=materials[cursor++]; const v=videos.find(v=>v.videoId===m.vod_video_id); const r={id:m.id,name:m.name,duration:m.duration,vod:v||null,lessons:lessons.filter(l=>l.material_id===m.id).map(l=>({id:l.id,course:l.course_name,series:l.series_name})),checks:[]};
 try {if(m.vod_video_id){const p=await callVodRpc('GetPlayInfo',{VideoId:m.vod_video_id,Formats:'m3u8,mp4',AuthTimeout:3600,PlayConfig:JSON.stringify({PlayDomain:'vod.swod.com.cn'})}); const opts=p.PlayInfoList?.PlayInfo||[];
 for(const o of opts.filter(o=>o.Format==='m3u8').slice(0,1)){const u=new URL(o.PlayURL);u.hostname='vod.swod.com.cn';const res=await fetch(u,{signal:AbortSignal.timeout(20000)});const txt=await res.text();const lines=txt.split(/\r?\n/).filter(l=>l&&!l.startsWith('#'));const check={status:res.status,hls:txt.startsWith('#EXTM3U'),segments:lines.length};if(lines.length){const seg=await fetch(new URL(lines[0],u),{headers:{Range:'bytes=0-1023'},signal:AbortSignal.timeout(20000)});check.segmentStatus=seg.status;await seg.body.cancel();}r.checks.push(check);}
 r.formats=[...new Set(opts.map(o=>o.Format))]; if(!r.checks.length)r.error='No HLS';
 }else {r.path=m.file_path;r.url=m.file_url;r.localExists=m.file_path?.startsWith('/uploads/')&&fs.existsSync(path.join(projectRoot,'public',decodeURIComponent(m.file_path)));}}
 catch(e){r.error=e.message;}results.push(r);if(results.length%25===0)console.log('checked',results.length);}}
 await Promise.all(Array.from({length:5},worker));
 const report={materials:materials.length,lessons:lessons.length,vodTotal:videos.length,orphanLessons:lessons.filter(l=>!materials.some(m=>m.id===l.material_id)),results};fs.writeFileSync('/tmp/course-video-audit.json',JSON.stringify(report,null,2));console.log(JSON.stringify({materials:report.materials,lessons:report.lessons,vodTotal:report.vodTotal,missingDuration:results.filter(r=>!r.duration).length,errors:results.filter(r=>r.error||r.checks.some(c=>c.status!==200||!c.hls||![200,206].includes(c.segmentStatus))),props:results.filter(r=>r.lessons.some(l=>(l.series+l.course).includes('全道具')))},null,2));
}
audit().catch(e=>{console.error(e.message);process.exit(1)});
