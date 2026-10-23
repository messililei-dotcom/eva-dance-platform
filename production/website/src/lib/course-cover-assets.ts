import manifest from '@/generated/course-cover-manifest.json';

type CoverAsset = {
  webp: string;
  avif: string;
  width: number;
  height: number;
  sourceBytes: number;
  webpBytes: number;
  avifBytes: number;
};

const covers = manifest.covers as Record<string, CoverAsset>;

function safelyDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeName(value: string) {
  return safelyDecode(value)
    .replace(/\.[^.]+$/, '')
    .replace(/-\d{8,}$/, '')
    .replace(/^成品舞[｜|]/, '')
    .replace(/[_\s"'“”‘’（）()·\-+]+/g, '')
    .toLowerCase();
}

function filenameFromCoverUrl(value: string) {
  const clean = value.split(/[?#]/, 1)[0];
  return safelyDecode(clean.split('/').pop() || '');
}

export function findStaticSeriesCover(value?: string): CoverAsset | null {
  const image = String(value || '').trim();
  if (!image.includes('/api/course/series/cover/')) return null;
  const filename = filenameFromCoverUrl(image);
  if (!filename) return null;
  if (covers[filename]) return covers[filename];

  const wanted = normalizeName(filename);
  if (!wanted) return null;
  const matched = Object.entries(covers).find(([candidate]) => {
    const normalized = normalizeName(candidate);
    return normalized === wanted || normalized.startsWith(wanted) || wanted.startsWith(normalized);
  });
  return matched?.[1] || null;
}

export function resolveStaticSeriesCover(value?: string) {
  return findStaticSeriesCover(value)?.webp || '';
}
