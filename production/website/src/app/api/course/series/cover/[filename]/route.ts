import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { findStaticSeriesCover } from '@/lib/course-cover-assets';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_ADMIN_UPLOADS_ROOT = '/www/wwwroot/dongfangwuquan/admin-platform/public/uploads';
const ADMIN_UPLOADS_ROOT = process.env.ADMIN_UPLOADS_ROOT || DEFAULT_ADMIN_UPLOADS_ROOT;
const SERIES_COVERS_ROOT = path.join(
  /* turbopackIgnore: true */ ADMIN_UPLOADS_ROOT,
  'online-course',
  'series-covers',
);

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

function directCoverPath(filename: string) {
  const root = path.resolve(/* turbopackIgnore: true */ SERIES_COVERS_ROOT);
  const absolutePath = path.resolve(/* turbopackIgnore: true */ root, filename);
  if (!absolutePath.startsWith(root + path.sep)) return null;
  return fs.existsSync(/* turbopackIgnore: true */ absolutePath)
    && fs.statSync(/* turbopackIgnore: true */ absolutePath).isFile()
    ? absolutePath
    : null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const routeParams = await params;
  const filename = path.basename(decodeURIComponent(routeParams.filename || ''));
  if (!filename || !isImage(filename)) return new Response('Not found', { status: 404 });

  const staticCover = findStaticSeriesCover(`/api/course/series/cover/${encodeURIComponent(filename)}`);
  if (staticCover) {
    return new Response(null, {
      status: 308,
      headers: {
        Location: staticCover.webp,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  }

  const filePath = directCoverPath(filename);
  if (!filePath) return new Response('Not found', { status: 404 });

  const stat = fs.statSync(/* turbopackIgnore: true */ filePath);
  return new Response(Readable.toWeb(fs.createReadStream(/* turbopackIgnore: true */ filePath)) as ReadableStream, {
    headers: {
      'Content-Type': contentType(filePath),
      'Content-Length': String(stat.size),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
