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


process.env.ALIYUN_VOD_REGION='cn-shanghai';
async function fix(){const before=JSON.parse(fs.readFileSync('/tmp/vod-cors-before.json','utf8'));const config=before.DomainConfigs.DomainConfig.find(c=>c.FunctionArgs.FunctionArg.some(a=>a.ArgName==='key'&&a.ArgValue==='Access-Control-Allow-Origin'));if(!config)throw Error('Missing existing origin rule');const args=config.FunctionArgs.FunctionArg.map(a=>({argName:a.ArgName,argValue:a.ArgValue}));args.find(a=>a.argName==='value').argValue='https://www.swod.com.cn,https://admin.swod.com.cn,https://www.dongfangwuquan.com,https://admin.dongfangwuquan.com';args.push({argName:'access_origin_control',argValue:'on'});const params={DomainNames:'vod.swod.com.cn',Functions:JSON.stringify([{functionName:'set_resp_header',configId:config.ConfigId,functionArgs:args}])};console.log(JSON.stringify(params));if(process.argv.includes('--execute'))console.log(JSON.stringify(await callVodRpc('BatchSetVodDomainConfigs',params)));}
fix().catch(e=>{console.error(e.message);process.exit(1)});
