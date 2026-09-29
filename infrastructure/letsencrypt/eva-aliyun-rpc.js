#!/usr/bin/env node

const crypto = require('crypto');
const https = require('https');
const { execFileSync } = require('child_process');

function percentEncode(value) {
  return encodeURIComponent(String(value))
    .replace(/\+/g, '%20')
    .replace(/\*/g, '%2A')
    .replace(/%7E/g, '~');
}

function loadProductionCredentials() {
  const processes = JSON.parse(execFileSync('/usr/bin/pm2', ['jlist'], { encoding: 'utf8' }));
  const target = processes.find((item) => item.name === 'admin-platform');
  const env = (target && target.pm2_env) || {};
  const accessKeyId = env.ALIYUN_ACCESS_KEY_ID || '';
  const accessKeySecret = env.ALIYUN_ACCESS_KEY_SECRET || '';
  if (!accessKeyId || !accessKeySecret) {
    throw new Error('Production Aliyun credentials are not available in PM2.');
  }
  return { accessKeyId, accessKeySecret };
}

function signedParams({ action, version, regionId, params }) {
  const { accessKeyId, accessKeySecret } = loadProductionCredentials();
  const all = {
    Action: action,
    Version: version,
    Format: 'JSON',
    SignatureMethod: 'HMAC-SHA1',
    SignatureNonce: `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`,
    SignatureVersion: '1.0',
    AccessKeyId: accessKeyId,
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    RegionId: regionId,
  };
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null && value !== '') all[key] = String(value);
  }
  const canonical = Object.keys(all)
    .sort()
    .map((key) => `${percentEncode(key)}=${percentEncode(all[key])}`)
    .join('&');
  const stringToSign = `POST&${percentEncode('/')}&${percentEncode(canonical)}`;
  const signature = crypto
    .createHmac('sha1', `${accessKeySecret}&`)
    .update(stringToSign)
    .digest('base64');
  return { ...all, Signature: signature };
}

function request(options) {
  const body = new URLSearchParams(signedParams(options)).toString();
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: options.endpoint,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 30000,
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsed;
        try {
          parsed = JSON.parse(data || '{}');
        } catch {
          reject(new Error(`Aliyun response was not JSON (HTTP ${res.statusCode}).`));
          return;
        }
        if ((res.statusCode || 500) >= 400 || parsed.Code) {
          const error = new Error(parsed.Message || parsed.Code || `HTTP ${res.statusCode}`);
          error.code = parsed.Code || '';
          error.statusCode = res.statusCode || 0;
          error.requestId = parsed.RequestId || '';
          reject(error);
          return;
        }
        resolve(parsed);
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Aliyun RPC timeout.')));
    req.write(body);
    req.end();
  });
}

async function main() {
  const [endpoint, version, regionId, action, paramsJson = '{}'] = process.argv.slice(2);
  if (!endpoint || !version || !regionId || !action) {
    throw new Error('Usage: aliyun-rpc.js <endpoint> <version> <region> <action> [params-json]');
  }
  const result = await request({
    endpoint,
    version,
    regionId,
    action,
    params: JSON.parse(paramsJson === '-' ? require('node:fs').readFileSync(0, 'utf8') : paramsJson),
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({
    error: error.message,
    code: error.code || '',
    statusCode: error.statusCode || 0,
    requestId: error.requestId || '',
  })}\n`);
  process.exit(1);
});
