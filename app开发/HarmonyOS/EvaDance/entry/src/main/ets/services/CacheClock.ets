export interface CacheClockAnchor { server: number; elapsed: number; boot: string; }
export function trustedCacheTime(anchor: CacheClockAnchor, elapsed: number, boot: string): number {
  if (!anchor.boot || anchor.boot !== boot || !Number.isFinite(anchor.server) || !Number.isFinite(anchor.elapsed) || !Number.isFinite(elapsed) || anchor.elapsed < 0 || elapsed < anchor.elapsed) return Number.NaN;
  return anchor.server + elapsed - anchor.elapsed;
}
