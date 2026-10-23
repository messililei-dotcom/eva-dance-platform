import https from 'node:https';

const domain = process.env.PREWARM_DOMAIN || 'www.swod.com.cn';
const edgeIp = process.env.MACAU_WWW_EDGE_IP || '125.31.23.94';
const seriesIds = String(process.env.PREWARM_SERIES_IDS || '1,3,4,5,8,18,19,46')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean);
const initialPaths = [
  '/',
  '/courses',
  ...seriesIds.flatMap(id => [
    `/courses/${encodeURIComponent(id)}/videos?source=platform`,
    `/course-data/series/${encodeURIComponent(id)}/catalog.json`,
  ]),
];

function requestPath(pathname, collectBody = false) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const request = https.request({
      host: edgeIp,
      servername: domain,
      path: pathname,
      method: 'GET',
      headers: {
        Host: domain,
        'User-Agent': 'SWOD-CDN-Prewarm/1.0',
        Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
      },
      timeout: 30000,
    }, response => {
      const chunks = [];
      response.on('data', chunk => { if (collectBody) chunks.push(chunk); });
      response.on('end', () => resolve({
        path: pathname,
        status: response.statusCode || 0,
        elapsedMs: Date.now() - startedAt,
        cache: String(response.headers['x-cache'] || ''),
        body: collectBody ? Buffer.concat(chunks).toString('utf8') : '',
      }));
    });
    request.on('timeout', () => request.destroy(new Error(`timeout: ${pathname}`)));
    request.on('error', reject);
    request.end();
  });
}

async function inBatches(items, size, worker) {
  const results = [];
  for (let index = 0; index < items.length; index += size) {
    results.push(...await Promise.all(items.slice(index, index + size).map(worker)));
  }
  return results;
}

const pageResults = await inBatches(initialPaths, 4, path => requestPath(path, path === '/' || path.includes('/videos')));
const assets = new Set();
for (const result of pageResults) {
  for (const match of result.body.matchAll(/(?:src|href)="([^"]+\.(?:js|css)(?:\?[^"]*)?)"/g)) {
    if (match[1].startsWith('/')) assets.add(match[1]);
  }
}
const assetResults = await inBatches([...assets], 6, path => requestPath(path));
const results = [...pageResults, ...assetResults];
const failures = results.filter(result => result.status < 200 || result.status >= 400);

console.log(JSON.stringify({
  domain,
  edgeIp,
  requested: results.length,
  assets: assets.size,
  failures: failures.map(result => ({ path: result.path, status: result.status })),
  slowest: [...results]
    .sort((left, right) => right.elapsedMs - left.elapsedMs)
    .slice(0, 10)
    .map(result => ({ path: result.path, status: result.status, elapsedMs: result.elapsedMs, cache: result.cache })),
}, null, 2));

if (failures.length) process.exitCode = 1;
