import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const COVER_ROOT = path.join(process.cwd(), 'public', 'uploads', 'training-courses');
const COVER_PREFIX = 'uploads/training-courses/';
const FALLBACK_ROOTS = [
  COVER_ROOT,
  path.join(process.cwd(), 'public', 'images', 'courses', 'offline'),
  path.join(process.cwd(), '..', '02-官方网站工程设计', '官方网站', 'public', 'images', 'courses', 'offline'),
  path.join(process.cwd(), '..', '10-学员成长系统', 'public', 'images', 'courses', 'offline'),
];
const GENERIC_COVER = path.join(process.cwd(), 'public', 'learn', 'dance-hero.webp');
const KEYWORDS = [
  'tito',
  'alida',
  '技巧超魔',
  '门徒',
  '舞感',
  '芭蕾',
  '东方舞技巧大全',
  '融舞师资',
  '十全十美',
  '民俗',
  '传承弟子',
  '周末',
];

function contentType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.bmp') return 'image/bmp';
  if (ext === '.svg') return 'image/svg+xml';
  return 'application/octet-stream';
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function safeResolveTrainingPath(source: string) {
  const cleanSource = safeDecode(source).split('?')[0].split('#')[0].replace(/^\/+/, '');
  const relativePath = cleanSource.startsWith(COVER_PREFIX)
    ? cleanSource.slice(COVER_PREFIX.length)
    : path.basename(cleanSource);
  if (!relativePath) return null;

  const root = path.resolve(COVER_ROOT);
  const absolutePath = path.resolve(root, relativePath);
  if (absolutePath !== root && !absolutePath.startsWith(`${root}${path.sep}`)) return null;
  return absolutePath;
}

function normalizeName(value: string) {
  return safeDecode(path.basename(value))
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/-\d{8,}$/, '')
    .replace(/aiida/g, 'alida')
    .replace(/融合舞/g, '融舞')
    .replace(/[&＆]/g, '')
    .replace(/[\\/_\s"'“”‘’（）()《》·\-+~～、，,。:：|｜]+/g, '')
}

function searchableName(value: string) {
  return normalizeName(value)
    .replace(/国际/g, '')
    .replace(/老师/g, '')
    .replace(/大师/g, '')
    .replace(/系统/g, '')
    .replace(/主图/g, '')
    .replace(/课程/g, '')
    .replace(/集训营/g, '')
    .replace(/训练营/g, '')
    .replace(/认证教师\d*(?:-\d*)?级?/g, '')
    .replace(/\d+天.*$/g, '');
}

function listImages(root: string) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root)
    .filter(file => /\.(jpe?g|png|webp|gif|bmp|svg)$/i.test(file))
    .map(file => path.join(root, file))
    .filter(file => fs.existsSync(file) && fs.statSync(file).isFile());
}

function listFallbackImages() {
  const seen = new Set<string>();
  return FALLBACK_ROOTS.flatMap(listImages).filter(file => {
    const resolved = path.resolve(file);
    if (seen.has(resolved)) return false;
    seen.add(resolved);
    return true;
  });
}

function keywordMatch(wanted: string[], candidate: string) {
  return KEYWORDS.some(keyword => candidate.includes(keyword) && wanted.some(item => item.includes(keyword)));
}

function findFallbackCover(source: string, name: string) {
  const wanted = [source, name].flatMap(value => [normalizeName(value), searchableName(value)]).filter(Boolean);
  if (!wanted.length) return null;

  const files = listFallbackImages();
  return files.find(file => {
    const candidate = normalizeName(file);
    const searchableCandidate = searchableName(file);
    return wanted.some(item => candidate === item
      || searchableCandidate === item
      || candidate.includes(item)
      || item.includes(candidate)
      || searchableCandidate.includes(item)
      || item.includes(searchableCandidate))
      || keywordMatch(wanted, `${candidate}${searchableCandidate}`);
  }) || null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const source = searchParams.get('src') || '';
  const name = searchParams.get('name') || '';
  if ((!source && !name) || /^https?:\/\//i.test(source)) {
    return Response.json({ success: false, message: '图片路径无效' }, { status: 400 });
  }

  const directPath = source ? safeResolveTrainingPath(source) : null;
  const filePath = (directPath && fs.existsSync(directPath) && fs.statSync(directPath).isFile() ? directPath : null)
    || findFallbackCover(source, name)
    || (fs.existsSync(GENERIC_COVER) ? GENERIC_COVER : null);
  if (!filePath) return Response.json({ success: false, message: '图片不存在' }, { status: 404 });

  const stat = fs.statSync(filePath);
  return new Response(Readable.toWeb(fs.createReadStream(filePath)) as ReadableStream, {
    headers: {
      'Content-Type': contentType(filePath),
      'Content-Length': String(stat.size),
      'Cache-Control': 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
