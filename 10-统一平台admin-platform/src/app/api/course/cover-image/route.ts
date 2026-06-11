import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function contentType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.svg') return 'image/svg+xml';
  return 'image/jpeg';
}

function safeResolve(root: string, relativePath: string) {
  const absoluteRoot = path.resolve(root);
  const absolutePath = path.resolve(absoluteRoot, relativePath.replace(/^\/+/, ''));
  if (absolutePath !== absoluteRoot && !absolutePath.startsWith(`${absoluteRoot}${path.sep}`)) return null;
  return absolutePath;
}

function normalizeName(value: string) {
  return decodeURIComponent(value)
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
        && !/学员管理系统|扫码|ChatGPT Image|series-covers|training-courses/i.test(absolute)
      ) {
        files.push(absolute);
      }
    }
  };
  walk(root);
  return files;
}

function findFallbackImage(publicRoot: string, source: string) {
  const uploadsRoot = path.join(publicRoot, 'uploads');
  const images = listImages(uploadsRoot);
  if (!images.length) return null;
  const wanted = normalizeName(source);
  const matched = images.find(file => {
    const candidate = normalizeName(file);
    return candidate === wanted
      || candidate.includes(wanted)
      || wanted.includes(candidate)
      || (wanted.includes('呼吸') && candidate.includes('呼吸'));
  });
  return matched || null;
}

function isUsableCourseImage(filePath: string) {
  return !/学员管理系统|扫码|ChatGPT Image|series-covers|training-courses/i.test(filePath);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawSource = decodeURIComponent(searchParams.get('src') || '').trim();
  if (!rawSource || /^https?:\/\//i.test(rawSource)) {
    return Response.json({ success: false, message: '图片路径无效' }, { status: 400 });
  }

  const publicRoot = path.join(process.cwd(), 'public');
  const source = rawSource.split('?')[0].split('#')[0];

  const candidates = [
    safeResolve(publicRoot, source),
  ].filter(Boolean) as string[];

  const filePath = candidates.find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile() && isUsableCourseImage(candidate))
    || findFallbackImage(publicRoot, source);
  if (!filePath) {
    return Response.json({ success: false, message: '图片不存在' }, { status: 404 });
  }

  const stat = fs.statSync(filePath);
  return new Response(fs.createReadStream(filePath) as any, {
    headers: {
      'Content-Type': contentType(filePath),
      'Content-Length': String(stat.size),
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
