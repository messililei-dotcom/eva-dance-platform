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

const {execFileSync}=require('child_process');
const ts=require('typescript');const vm=require('vm');const exported={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(projectRoot,'src/lib/server/aliyun-vod.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2020}}).outputText,{exports:exported,require,process,Buffer,URL,URLSearchParams,console,setTimeout,clearTimeout});
async function verify(){const report=JSON.parse(fs.readFileSync('/tmp/course-video-audit.json'));const props=report.results.filter(r=>r.lessons.some(l=>(l.series||'').includes('全舞种')));const results=[];
for(const r of props){const url=await exported.getVodPlayUrl(r.vod.videoId,'hls-only');const u=new URL(url);const res=await fetch(u,{headers:{Origin:'https://admin.swod.com.cn'}});const txt=await res.text();const segments=txt.split(/\r?\n/).filter(x=>x&&!x.startsWith('#'));let failed=[];for(let i=0;i<segments.length;i+=8){await Promise.all(segments.slice(i,i+8).map(async s=>{const x=await fetch(new URL(s,u),{method:'HEAD',signal:AbortSignal.timeout(20000)});if(!x.ok)failed.push(x.status)}));}
let decode='ok';try{execFileSync('ffmpeg',['-v','error','-i',u.toString(),'-t','3','-f','null','-'],{timeout:45000,stdio:['ignore','ignore','pipe']});}catch(e){decode='failed';}results.push({id:r.id,name:r.name,segments:segments.length,failed,decode,cors:res.headers.get('access-control-allow-origin'),host:u.hostname});console.log(JSON.stringify(results.at(-1)));}fs.writeFileSync('/tmp/props-video-verification.json',JSON.stringify(results,null,2));}
verify().catch(e=>{console.error(e.message);process.exit(1)});
