import path from 'path';
import { mkdir, readFile, stat, realpath, writeFile, rename } from 'fs/promises';
import { createHash, randomUUID } from 'crypto';
import sharp from 'sharp';
import { NextResponse } from 'next/server';
import { getEventNewsBySlug } from '@/lib/events-news';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const conversions = new Map<string, Promise<Buffer>>();
const remoteHosts = new Set(['mmbiz.qpic.cn', 'csdfwq.oss-rg-china-mainland.aliyuncs.com', 'api-vmp.aibaozan.com', 'api-vmp.nanyuecloud.com']);
const MAX_SOURCE_BYTES = 30 * 1024 * 1024;

async function remoteSource(url: URL): Promise<Buffer> {
  // Fixed hosts only; never follow a redirect into an administrator-supplied host.
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(8000), cache: 'no-store' });
  if (!response.ok || Number(response.headers.get('content-length')) > MAX_SOURCE_BYTES || !response.body) throw new Error('Invalid cover response');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_SOURCE_BYTES) throw new Error('Cover exceeds size limit');
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  return Buffer.concat(chunks);
}

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  if (!/^[a-z0-9-]{1,100}$/i.test(slug)) return new NextResponse('Not found', { status: 404 });
  const item = getEventNewsBySlug(slug);
  if (!item?.coverImage) return fallbackCover();
  try {
    const coverUrl = new URL(item.coverImage);
    if (coverUrl.protocol !== 'https:') return fallbackCover();
    const requested = Number(new URL(request.url).searchParams.get('w') || 960);
    const width = [320, 640, 960].find(value => value >= requested) || 960;
    let source: string | URL = coverUrl;
    let version = coverUrl.href;
    if (coverUrl.hostname === 'admin.swod.com.cn' && coverUrl.pathname.startsWith('/uploads/event-covers/')) {
      const root = '/www/wwwroot/dongfangwuquan/admin-platform/public/uploads/event-covers';
      const filename = await realpath(path.resolve(root, decodeURIComponent(coverUrl.pathname.slice('/uploads/event-covers/'.length))));
      if (!filename.startsWith(root + '/')) return fallbackCover();
      const file = await stat(filename);
      if (file.size > MAX_SOURCE_BYTES) return fallbackCover();
      source = filename;
      version = `${filename}:${file.mtimeMs}:${file.size}`;
    } else if (!remoteHosts.has(coverUrl.hostname) || coverUrl.username || coverUrl.password || (coverUrl.port && coverUrl.port !== '443')) {
      return fallbackCover();
    } else {
      // Refresh remote covers daily; private event data is never cached here.
      version += `:${Math.floor(Date.now() / 86400000)}`;
    }
    const key = createHash('sha256').update(`${version}:${width}:webp-v2`).digest('hex');
    const etag = `"${key}"`;
    const headers = { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=300, s-maxage=3600', ETag: etag };
    if (request.headers.get('if-none-match') === etag) return new NextResponse(null, { status: 304, headers });
    const cacheDir = path.join(process.cwd(), '.cache/event-covers');
    const target = path.join(cacheDir, `${key}.webp`);
    let bytes: Buffer;
    try { bytes = await readFile(target); } catch {
      let pending = conversions.get(key);
      if (!pending) {
        pending = (async () => {
          const original = typeof source === 'string' ? source : await remoteSource(source);
          const image = await sharp(original, { limitInputPixels: 40000000 }).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 72, effort: 4 }).toBuffer();
          await mkdir(cacheDir, { recursive: true });
          const temporary = `${target}.${randomUUID()}.tmp`;
          await writeFile(temporary, image);
          await rename(temporary, target);
          return image;
        })();
        conversions.set(key, pending);
      }
      try { bytes = await pending; } finally { conversions.delete(key); }
    }
    return new NextResponse(new Uint8Array(bytes), { headers });
  } catch (error) {
    console.warn('赛事封面不可用', error);
    return fallbackCover();
  }
}

function fallbackCover() {
  return new NextResponse('<svg xmlns="http://www.w3.org/2000/svg" width="960" height="600" viewBox="0 0 960 600"><rect width="960" height="600" fill="#202020"/><text x="480" y="300" text-anchor="middle" fill="#d7bd84" font-size="52">AiwaRaks</text><text x="480" y="375" text-anchor="middle" fill="#d7bd84" font-size="28">东方舞赛事平台</text></svg>', { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=60' } });
}
