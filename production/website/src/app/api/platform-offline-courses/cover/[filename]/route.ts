import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_TRAINING_COURSES_ROOT = '/www/wwwroot/dongfangwuquan/admin-platform/public/uploads/training-courses';
const TRAINING_COURSES_ROOT = process.env.TRAINING_COURSES_ROOT || DEFAULT_TRAINING_COURSES_ROOT;
const IMAGE_CACHE_CONTROL = 'public, max-age=604800, s-maxage=31536000, stale-while-revalidate=86400';

function contentType(filename: string) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.bmp') return 'image/bmp';
  if (ext === '.svg') return 'image/svg+xml';
  return 'application/octet-stream';
}

function isImage(filename: string) {
  return /\.(jpe?g|png|webp|gif|bmp|svg)$/i.test(filename);
}

function trainingCoverPath(filename: string) {
  const root = path.resolve(/* turbopackIgnore: true */ TRAINING_COURSES_ROOT);
  const absolutePath = path.resolve(/* turbopackIgnore: true */ root, filename);
  if (!absolutePath.startsWith(root + path.sep)) return null;
  return fs.existsSync(/* turbopackIgnore: true */ absolutePath)
    && fs.statSync(/* turbopackIgnore: true */ absolutePath).isFile()
    ? absolutePath
    : null;
}

function fileEtag(stat: fs.Stats) {
  return `"${stat.size.toString(36)}-${Math.trunc(stat.mtimeMs).toString(36)}"`;
}

export async function GET(request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const routeParams = await params;
  const filename = path.basename(decodeURIComponent(routeParams.filename || ''));
  if (!filename || !isImage(filename)) return new Response('Not found', { status: 404 });

  const filePath = trainingCoverPath(filename);
  if (!filePath) return new Response('Not found', { status: 404 });

  const stat = fs.statSync(/* turbopackIgnore: true */ filePath);
  const etag = fileEtag(stat);
  if (request.headers.get('if-none-match') === etag) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: etag,
        'Cache-Control': IMAGE_CACHE_CONTROL,
      },
    });
  }

  return new Response(Readable.toWeb(fs.createReadStream(/* turbopackIgnore: true */ filePath)) as ReadableStream, {
    headers: {
      'Content-Type': contentType(filePath),
      'Content-Length': String(stat.size),
      ETag: etag,
      'Last-Modified': stat.mtime.toUTCString(),
      'Cache-Control': IMAGE_CACHE_CONTROL,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
