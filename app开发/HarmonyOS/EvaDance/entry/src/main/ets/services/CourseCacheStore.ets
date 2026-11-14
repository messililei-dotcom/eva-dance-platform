import { common } from '@kit.AbilityKit';
import { fileIo, statfs } from '@kit.CoreFileKit';
import { systemDateTime, deviceInfo } from '@kit.BasicServicesKit';
import { connection, http } from '@kit.NetworkKit';
import { util } from '@kit.ArkTS';
import { PlatformApi, PlatformFailure } from './PlatformApi';
import { HuksVault } from './HuksVault';
import { CacheClockAnchor, trustedCacheTime } from './CacheClock';
import { COURSE_CACHE_RELEASE_ENABLED, VideoCacheLease, permitsCachedVideo } from './VideoCachePolicy';
import { AutomaticVideoCacheRenewal, CacheRenewalHooks } from './AutomaticVideoCacheRenewal';
import { AliyunSecureCacheDriver } from './AliyunSecureCacheDriver';
import { Row } from './Models';

export interface CachedCourse {
  id: number; nonce: string; title: string; course: string; lease: VideoCacheLease; anchor: CacheClockAnchor;
  file: string; state: string; percent: number; bytes: number; position: number; duration: number; revision: number; pending: boolean;
}
interface CacheInventory { device: string; items: CachedCourse[]; }
interface CacheCredential { play_auth: string; }
interface CacheGrant extends VideoCacheLease { credential?: CacheCredential; max_bytes: number; }

export class CourseCacheStore {
  private static instance?: CourseCacheStore;
  static shared(context: common.UIAbilityContext, api: PlatformApi): CourseCacheStore {
    const existing = CourseCacheStore.instance;
    if (existing) return existing;
    const store = new CourseCacheStore(context, api);
    CourseCacheStore.instance = store;
    store.initialize();
    return store;
  }
  private context: common.UIAbilityContext;
  private api: PlatformApi;
  private vault: HuksVault;
  private driver: AliyunSecureCacheDriver;
  private inventory: CacheInventory = { device: '', items: [] };
  private renewals: Map<number, AutomaticVideoCacheRenewal> = new Map();
  private timer: number = -1;
  private generation: number = 0;
  private busy: boolean = false;
  downloading: number = 0;
  message: string = '';
  changed: () => void = () => {};
  root: string;
  constructor(context: common.UIAbilityContext, api: PlatformApi) {
    this.context = context; this.api = api; this.root = context.filesDir + '/course-cache';
    this.vault = new HuksVault(context.filesDir, 'course-cache'); this.driver = new AliyunSecureCacheDriver(context);
  }
  async initialize(): Promise<void> {
    try {
      const data = await this.vault.read();
      if (data) this.inventory = JSON.parse(data) as CacheInventory;
      if (!this.inventory.device) this.inventory.device = util.generateRandomUUID().replace(/-/g, '') + util.generateRandomUUID().replace(/-/g, '');
      this.inventory.items.forEach((item: CachedCourse) => { if (item.state !== 'ready') { item.state = 'paused'; item.file = ''; this.deleteFiles(item.id); } });
      await this.persist();
      this.api.cacheInvalidation = () => { this.purge(); };
      this.timer = setInterval(() => { this.refresh(); }, 60000); await this.refresh();
    } catch { this.inventory.items = []; this.message = '安全离线内容索引不可用，请联网后重试'; }
    this.changed();
  }
  private elapsed(): number { return systemDateTime.getUptime(systemDateTime.TimeType.STARTUP, false); }
  private boot(): string { const count = deviceInfo.bootCount; return count >= 0 ? 'boot:' + count : ''; }
  private current(lease: VideoCacheLease): boolean { return this.api.credentials?.memberId === lease.member_id && this.api.credentials?.sessionId === lease.session_id; }
  visible(): CachedCourse[] { return this.inventory.items.filter((item: CachedCourse) => this.current(item.lease)); }
  get(id: number): CachedCourse | undefined { return this.visible().find((item: CachedCourse) => item.id === id); }
  file(item: CachedCourse): string {
    if (!item.file || item.file.startsWith('/') || item.file.split('/').includes('..')) return '';
    const path = this.root + '/' + item.file;
    try { return fileIo.statSync(path).isFile() ? path : ''; } catch { return ''; }
  }
  usable(item: CachedCourse): boolean {
    return COURSE_CACHE_RELEASE_ENABLED && this.current(item.lease) && item.state === 'ready' && this.file(item).length > 0 &&
      permitsCachedVideo(item.lease, item.lease.member_id, item.lease.session_id, this.inventory.device, item.id, trustedCacheTime(item.anchor, this.elapsed(), this.boot()));
  }
  private persist(): Promise<void> { return this.vault.save(JSON.stringify(this.inventory)); }
  private deleteTree(path: string): void {
    if ((path !== this.root && !path.startsWith(this.root + '/')) || path.includes('..')) return;
    try {
      if (fileIo.statSync(path).isDirectory()) { fileIo.listFileSync(path, { recursion: false }).forEach((name: string) => this.deleteTree(path + '/' + name)); fileIo.rmdirSync(path); }
      else fileIo.unlinkSync(path);
    } catch {}
  }
  private deleteFiles(id: number): void { this.deleteTree(this.root + '/' + id); }
  purge(): void {
    this.generation++; this.driver.stop(); this.downloading = 0; this.renewals.forEach((renewal: AutomaticVideoCacheRenewal) => renewal.stop()); this.renewals.clear();
    this.inventory.items = []; this.persist().catch(() => {}); this.deleteTree(this.root); this.changed();
  }
  remove(id: number): void {
    if (this.downloading === id) { this.generation++; this.driver.stop(); this.downloading = 0; }
    this.renewals.get(id)?.stop(); this.renewals.delete(id); this.inventory.items = this.inventory.items.filter((item: CachedCourse) => item.id !== id);
    this.persist().catch(() => { this.message = '离线索引保存失败'; }); this.deleteFiles(id); this.changed();
  }
  pause(id: number): void {
    if (this.downloading !== id) return; this.generation++; this.driver.stop(); this.downloading = 0;
    const item = this.get(id); if (item) item.state = 'paused'; this.persist().catch(() => {}); this.changed();
  }
  private lease(grant: CacheGrant): VideoCacheLease {
    return { member_id: grant.member_id, session_id: grant.session_id, device_id: grant.device_id, lesson_id: grant.lesson_id, series_id: grant.series_id,
      vod_video_id: grant.vod_video_id, material_version: grant.material_version, issued_at: grant.issued_at, expires_at: grant.expires_at, mode: grant.mode };
  }
  private authorize(id: number, action: string, material: string = ''): Promise<CacheGrant> {
    return this.api.request<CacheGrant>('/video/' + id + '/cache-authorization', http.RequestMethod.POST,
      { action: action, device_id: this.inventory.device, material_version: material }, true);
  }
  async refresh(): Promise<void> {
    if (this.busy || !this.api.credentials) return; this.busy = true;
    try {
      const stale = this.inventory.items.filter((item: CachedCourse) => !this.current(item.lease)); stale.forEach((item: CachedCourse) => this.remove(item.id));
      for (const item of this.visible()) {
        if (item.state !== 'ready') continue;
        if (!this.renewals.has(item.id)) {
          let stamp: number = 0;
          const hooks: CacheRenewalHooks = {
            trustedNow: () => trustedCacheTime(item.anchor, this.elapsed(), this.boot()), retryNow: () => this.elapsed(),
            online: () => connection.hasDefaultNetSync(), isCurrent: () => this.current(item.lease) && this.get(item.id)?.nonce === item.nonce,
            renew: async (old: VideoCacheLease) => { stamp = this.elapsed(); const grant = await this.authorize(item.id, 'renew', old.material_version); return this.lease(grant); },
            persist: async (next: VideoCacheLease) => {
              if (this.get(item.id)?.nonce !== item.nonce || !this.current(next)) throw new Error('账号已变化');
              const old = item.lease; const oldAnchor = item.anchor; item.lease = next; item.anchor = { server: next.issued_at, elapsed: stamp, boot: this.boot() };
              try { await this.persist(); } catch { item.lease = old; item.anchor = oldAnchor; throw new Error('保存授权失败'); }
            }, discard: () => { if (this.get(item.id)?.nonce === item.nonce) this.remove(item.id); }
          };
          this.renewals.set(item.id, new AutomaticVideoCacheRenewal(item.lease, hooks));
        }
        await this.renewals.get(item.id)?.refresh(); await this.syncProgress(item.id);
      }
    } finally { this.busy = false; this.changed(); }
  }
  async download(id: number, title: string, course: string): Promise<void> {
    if (!COURSE_CACHE_RELEASE_ENABLED) { this.message = '安全离线观看尚未开放，请先在线观看'; this.changed(); return; }
    if (this.downloading) { this.message = '请等待当前课节下载完成，或先取消任务'; this.changed(); return; }
    if (!await this.driver.configured()) { this.message = '安全下载授权尚未配置完成，请先在线观看'; this.changed(); return; }
    if (this.inventory.items.length >= 12 && !this.get(id)) { this.message = '最多下载12节，请先删除不需要的离线内容'; this.changed(); return; }
    const version = this.generation; this.downloading = id; this.message = '正在验证离线观看权限'; this.changed();
    const stamp = this.elapsed();
    try {
      const grant = await this.authorize(id, 'download');
      if (version !== this.generation || !this.current(grant) || !grant.credential?.play_auth) throw new Error('账号或离线观看权限已变化');
      this.downloading = 0; this.remove(id); this.downloading = id;
      const item: CachedCourse = { id: id, nonce: util.generateRandomUUID(), title: title, course: course, lease: this.lease(grant),
        anchor: { server: grant.issued_at, elapsed: stamp, boot: this.boot() }, file: '', state: 'downloading', percent: 0, bytes: 0, position: 0, duration: 0, revision: 0, pending: false };
      try { const progress = await this.api.request<Row>('/video/' + id + '/progress', http.RequestMethod.GET, undefined, true); item.position = progress.progress || 0; item.revision = progress.revision || 0; } catch {}
      if (version !== this.generation || !this.current(grant)) return;
      this.inventory.items.push(item); await this.persist(); this.changed();
      const used = AliyunSecureCacheDriver.directoryBytes(this.root);
      const allowed = (): boolean => version === this.generation && this.get(id)?.nonce === item.nonce && this.current(item.lease) && permitsCachedVideo(item.lease, item.lease.member_id, item.lease.session_id, this.inventory.device, id, trustedCacheTime(item.anchor, this.elapsed(), this.boot()));
      await this.driver.start(grant.vod_video_id, grant.credential.play_auth, this.root + '/' + id, Math.min(grant.max_bytes, 2147483648 - used, statfs.getFreeSizeSync(this.context.filesDir) - 104857600), allowed, {
        progress: (percent: number) => { if (allowed()) { item.percent = Math.min(99, Math.max(0, percent)); this.changed(); } },
        complete: (path: string) => {
          if (!allowed()) { this.remove(id); return; }
          item.file = path.slice(this.root.length + 1); item.state = 'ready'; item.percent = 100; item.bytes = AliyunSecureCacheDriver.directoryBytes(this.root + '/' + id); this.downloading = 0;
          this.persist().then(() => { this.message = '下载完成'; this.changed(); this.refresh(); }).catch(() => { this.remove(id); this.message = '下载内容无法安全保存，请重试'; this.changed(); });
        }, failure: (message: string) => { if (version === this.generation) { this.remove(id); this.message = message; this.changed(); } }
      });
    } catch { if (version === this.generation) { this.downloading = 0; this.remove(id); this.message = '安全下载失败，请联网重试'; this.changed(); } }
  }
  checkpoint(id: number, position: number, duration: number): void {
    const item = this.get(id); if (!item || !this.usable(item) || !Number.isFinite(position) || !Number.isFinite(duration) || duration <= 0 || position < 0 || position > duration + 1) return;
    item.position = Math.min(position, duration); item.duration = duration; item.pending = true;
    this.persist().catch(() => { this.message = '本机学习进度保存失败'; });
  }
  private async syncProgress(id: number): Promise<void> {
    const item = this.get(id); if (!item?.pending || !this.usable(item) || !connection.hasDefaultNetSync()) return;
    const position = item.position;
    try {
      const result = await this.api.request<Row>('/video/' + id + '/progress', http.RequestMethod.POST, { progress: position, duration: item.duration, revision: item.revision }, true);
      if (this.get(id)?.nonce !== item.nonce || !this.current(item.lease) || item.position !== position) return;
      item.revision = result.revision || item.revision; item.pending = false; await this.persist();
    } catch (error) {
      if (error instanceof PlatformFailure && error.status === 409) {
        try {
          const newer = await this.api.request<Row>('/video/' + id + '/progress', http.RequestMethod.GET, undefined, true);
          if (this.get(id)?.nonce !== item.nonce || !this.current(item.lease) || item.position !== position) return;
          item.position = newer.progress || 0; item.duration = newer.duration || item.duration; item.revision = newer.revision || item.revision; item.pending = false; await this.persist();
        } catch {}
      }
    }
  }
  stop(): void { if (this.timer >= 0) clearInterval(this.timer); this.timer = -1; this.driver.stop(); }
}
