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

function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, character => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '"': '&quot;',
    "'": '&apos;',
  }[character] || character));
}

function generatedCourseCover(name: string) {
  const title = escapeXml((name || '伊娃东方舞线下课').trim().slice(0, 18));
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
  <defs>
    <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2c1810"/>
      <stop offset="0.58" stop-color="#5b2420"/>
      <stop offset="1" stop-color="#9f1d20"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.78" cy="0.18" r="0.72">
      <stop offset="0" stop-color="#e2c88e" stop-opacity="0.45"/>
      <stop offset="1" stop-color="#e2c88e" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="900" fill="url(#background)"/>
  <rect width="1200" height="900" fill="url(#glow)"/>
  <circle cx="970" cy="160" r="250" fill="none" stroke="#e2c88e" stroke-opacity="0.22" stroke-width="3"/>
  <circle cx="970" cy="160" r="180" fill="none" stroke="#e2c88e" stroke-opacity="0.16" stroke-width="2"/>
  <text x="92" y="128" fill="#e2c88e" font-size="34" font-family="sans-serif" letter-spacing="8">EVA ORIENTAL DANCE</text>
  <text x="92" y="520" fill="#ffffff" font-size="68" font-weight="700" font-family="sans-serif">${title}</text>
  <line x1="92" y1="580" x2="350" y2="580" stroke="#e2c88e" stroke-width="6"/>
  <text x="92" y="652" fill="#f3e7cb" font-size="34" font-family="sans-serif" letter-spacing="4">伊娃东方舞 · 线下课程</text>
</svg>`;
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
  if (!filePath) {
    return new Response(generatedCourseCover(name), {
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

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
