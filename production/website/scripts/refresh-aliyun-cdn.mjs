import crypto from 'node:crypto';
import https from 'node:https';

const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID;
const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET;
if (!accessKeyId || !accessKeySecret) {
  throw new Error('ALIYUN_ACCESS_KEY_ID and ALIYUN_ACCESS_KEY_SECRET are required');
}

const objectPath = process.argv.slice(2).join('\n') || 'https://www.swod.com.cn/';
const encode = value => encodeURIComponent(String(value))
  .replace(/!/g, '%21')
  .replace(/'/g, '%27')
  .replace(/\(/g, '%28')
  .replace(/\)/g, '%29')
  .replace(/\*/g, '%2A');

const parameters = {
  AccessKeyId: accessKeyId,
  Action: 'RefreshObjectCaches',
  Format: 'JSON',
  ObjectPath: objectPath,
  ObjectType: objectPath.endsWith('/') ? 'Directory' : 'File',
  SignatureMethod: 'HMAC-SHA1',
  SignatureNonce: crypto.randomUUID(),
  SignatureVersion: '1.0',
  Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  Version: '2018-05-10',
};
const canonicalQuery = Object.entries(parameters)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([key, value]) => `${encode(key)}=${encode(value)}`)
  .join('&');
const stringToSign = `GET&${encode('/')}&${encode(canonicalQuery)}`;
const signature = crypto.createHmac('sha1', `${accessKeySecret}&`).update(stringToSign).digest('base64');
const requestPath = `/?${canonicalQuery}&Signature=${encode(signature)}`;

const response = await new Promise((resolve, reject) => {
  const request = https.request({
    hostname: 'cdn.aliyuncs.com',
    method: 'GET',
    path: requestPath,
    timeout: 30000,
  }, incoming => {
    const chunks = [];
    incoming.on('data', chunk => chunks.push(chunk));
    incoming.on('end', () => resolve({ status: incoming.statusCode || 0, body: Buffer.concat(chunks).toString('utf8') }));
  });
  request.on('timeout', () => request.destroy(new Error('Aliyun CDN refresh timed out')));
  request.on('error', reject);
  request.end();
});

const parsed = JSON.parse(response.body || '{}');
if (response.status < 200 || response.status >= 300 || parsed.Code) {
  throw new Error(`Aliyun CDN refresh failed: ${parsed.Code || response.status} ${parsed.Message || ''}`.trim());
}
console.log(JSON.stringify({
  refreshTaskId: parsed.RefreshTaskId,
  requestId: parsed.RequestId,
  objectPath,
}, null, 2));
