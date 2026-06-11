import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const COVER_ROOT = path.join(process.cwd(), 'public', 'uploads', 'online-course', 'series-covers');
const UPLOADS_ROOT = path.join(process.cwd(), 'public', 'uploads');

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

function normalizeName(value: string) {
  return value
    .replace(/\.[^.]+$/, '')
    .replace(/-\d{8,}$/, '')
    .replace(/^成品舞[｜|]/, '')
    .replace(/[_\s"'“”‘’（）()·\-+]+/g, '')
    .toLowerCase();
}

function listImages(root: string) {
  if (!fs.existsSync(root)) return [];
  const files: string[] = [];
  const walk = (directory: string) => {
    for (const item of fs.readdirSync(directory)) {
      const absolute = path.join(directory, item);
      const stat = fs.statSync(absolute);
      if (stat.isDirectory()) {
        walk(absolute);
      } else if (
        /\.(jpe?g|png|webp|gif|svg)$/i.test(item)
        && !/学员管理系统|扫码|ChatGPT Image|\/video\//i.test(absolute)
      ) {
        files.push(absolute);
      }
    }
  };
  walk(root);
  return files;
}

function findFallbackCover(filename: string) {
  const wanted = normalizeName(filename);
  if (!wanted || !fs.existsSync(COVER_ROOT)) return null;
  const files = fs.readdirSync(COVER_ROOT).filter(file => {
    const absolute = path.join(COVER_ROOT, file);
    return fs.statSync(absolute).isFile();
  });
  const matched = files.find(file => {
    const candidate = normalizeName(file);
    return candidate === wanted || candidate.startsWith(wanted) || wanted.startsWith(candidate);
  });
  return matched ? path.join(COVER_ROOT, matched) : null;
}

function findFallbackUpload(filename: string) {
  const wanted = normalizeName(filename);
  const files = listImages(UPLOADS_ROOT);
  if (!wanted || !files.length) return null;
  const matched = files.find(file => {
    const candidate = normalizeName(file);
    return candidate === wanted
      || candidate.includes(wanted)
      || wanted.includes(candidate)
      || (wanted.includes('呼吸') && candidate.includes('呼吸'));
  });
  return matched || null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const routeParams = await params;
  const filename = path.basename(decodeURIComponent(routeParams.filename || ''));
  const absolutePath = path.resolve(COVER_ROOT, filename);
  const root = path.resolve(COVER_ROOT);
  if (!filename || !absolutePath.startsWith(root + path.sep)) return new Response('Not found', { status: 404 });
  const directPath = fs.existsSync(absolutePath) ? absolutePath : null;
  const filePath = directPath || findFallbackCover(filename) || findFallbackUpload(filename);
  if (!filePath) return new Response('Not found', { status: 404 });

  const stat = fs.statSync(filePath);
  return new Response(Readable.toWeb(fs.createReadStream(filePath)) as ReadableStream, {
    headers: {
      'Content-Type': contentType(filePath),
      'Content-Length': String(stat.size),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
