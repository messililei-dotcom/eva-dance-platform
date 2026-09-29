import { getVodPlayOptions, type VodPlayOption } from './aliyun-vod';

type CacheEntry = {
  expiresAt: number;
  promise: Promise<VodPlayOption[]>;
};

const DEFAULT_TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 500;
const playOptionsCache = new Map<string, CacheEntry>();

function cacheTtlMs() {
  const configured = Number(process.env.ALIYUN_VOD_PLAY_CACHE_TTL_MS || DEFAULT_TTL_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TTL_MS;
}

function cloneOptions(options: VodPlayOption[]) {
  return options.map(option => ({ ...option }));
}

function trimCache(now: number) {
  for (const [key, entry] of playOptionsCache) {
    if (entry.expiresAt <= now) playOptionsCache.delete(key);
  }
  while (playOptionsCache.size >= MAX_ENTRIES) {
    const oldestKey = playOptionsCache.keys().next().value;
    if (!oldestKey) break;
    playOptionsCache.delete(oldestKey);
  }
}

export async function getCachedVodPlayOptions(videoId: string) {
  const key = String(videoId || '').trim();
  if (!key) return [];
  const now = Date.now();
  const cached = playOptionsCache.get(key);
  if (cached && cached.expiresAt > now) return cloneOptions(await cached.promise);

  trimCache(now);
  const promise = getVodPlayOptions(key)
    .then(cloneOptions)
    .catch(error => {
      playOptionsCache.delete(key);
      throw error;
    });
  playOptionsCache.set(key, { expiresAt: now + cacheTtlMs(), promise });
  return cloneOptions(await promise);
}
