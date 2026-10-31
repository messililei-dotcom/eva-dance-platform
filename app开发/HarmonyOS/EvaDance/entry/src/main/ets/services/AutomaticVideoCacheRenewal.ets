import { VideoCacheLease, permitsCachedVideo, shouldRenewVideoCache, invalidatesVideoCache } from './VideoCachePolicy';
import { PlatformFailure } from './PlatformApi';

export interface CacheRenewalHooks {
  trustedNow: () => number; retryNow: () => number; online: () => boolean; isCurrent: () => boolean;
  renew: (lease: VideoCacheLease) => Promise<VideoCacheLease>;
  persist: (lease: VideoCacheLease) => Promise<void>; discard: () => void;
}
/** The owner registers foreground/network events; a timer retries quietly while the app is running. */
export class AutomaticVideoCacheRenewal {
  lease: VideoCacheLease;
  private hooks: CacheRenewalHooks;
  private revoked: boolean = false;
  private busy: boolean = false;
  private lastAttempt: number = -Number.MAX_VALUE;
  private timer: number = -1;
  constructor(lease: VideoCacheLease, hooks: CacheRenewalHooks) { this.lease = lease; this.hooks = hooks; }
  canPlay(): boolean { return !this.revoked && this.hooks.isCurrent() && permitsCachedVideo(this.lease, this.lease.member_id, this.lease.session_id, this.lease.device_id, this.lease.lesson_id, this.hooks.trustedNow()); }
  async refresh(): Promise<void> {
    if (this.revoked || this.busy) return;
    if (!this.hooks.isCurrent()) { this.invalidate(); return; }
    const now = this.hooks.trustedNow();
    const stamp = this.hooks.retryNow(); const since = stamp - this.lastAttempt;
    if (!this.hooks.online() || !Number.isFinite(stamp) || since < 60000 || (Number.isFinite(now) && now >= this.lease.issued_at && now < this.lease.expires_at - 21600000 && since < 300000)) return;
    this.busy = true; this.lastAttempt = stamp;
    try {
      const next = await this.hooks.renew(this.lease);
      if (this.revoked || !this.hooks.isCurrent()) { this.invalidate(); return; }
      if (next.series_id !== this.lease.series_id || next.material_version !== this.lease.material_version || next.vod_video_id !== this.lease.vod_video_id || !permitsCachedVideo(next, this.lease.member_id, this.lease.session_id, this.lease.device_id, this.lease.lesson_id, next.issued_at)) { this.invalidate(); return; }
      await this.hooks.persist(next); if (!this.hooks.isCurrent() || this.revoked) { this.invalidate(); return; } this.lease = next;
    } catch (error) { if (error instanceof PlatformFailure && invalidatesVideoCache(error.status)) this.invalidate(); }
    finally { this.busy = false; }
  }
  start(): void { this.stop(); if (this.revoked) return; this.timer = setInterval(() => { this.refresh(); }, 60000); this.refresh(); }
  stop(): void { if (this.timer >= 0) clearInterval(this.timer); this.timer = -1; }
  private invalidate(): void { this.revoked = true; this.stop(); this.hooks.discard(); }
}
