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

function filenameFromCoverUrl(value: string) {
  const clean = value.split(/[?#]/, 1)[0];
  return safelyDecode(clean.split('/').pop() || '');
}

export function findStaticSeriesCover(value?: string): CoverAsset | null {
  const image = String(value || '').trim();
  if (!image.includes('/api/course/series/cover/')) return null;
  const filename = filenameFromCoverUrl(image);
  if (!filename) return null;
  // A changed filename is a new asset version; never reuse a same-title historical cover.
  return covers[filename] || null;
}

export function resolveStaticSeriesCover(value?: string) {
  return findStaticSeriesCover(value)?.webp || '';
}
