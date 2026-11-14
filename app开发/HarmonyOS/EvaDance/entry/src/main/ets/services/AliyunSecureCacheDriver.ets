import { common } from '@kit.AbilityKit';
import { fileIo } from '@kit.CoreFileKit';
import { AliMediaDownloader, AliDownloaderFactory, PrivateService, VidAuth, MediaInfo, TrackInfo, ErrorInfo, Logger } from 'premierlibrary';

export interface CacheDownloadCallbacks { progress: (percent: number) => void; complete: (path: string) => void; failure: (message: string) => void; }
/** SDK media I/O; application lease checks are mandatory, including during download and completion. */
export class AliyunSecureCacheDriver {
  static async initializeKey(context: common.UIAbilityContext): Promise<void> {
    const bytes = await context.resourceManager.getRawFileContent('encryptedApp.dat');
    const path = context.filesDir + '/vod-encryptedApp.dat';
    const file = fileIo.openSync(path, fileIo.OpenMode.CREATE | fileIo.OpenMode.TRUNC | fileIo.OpenMode.WRITE_ONLY);
    try { fileIo.writeSync(file.fd, bytes.buffer); fileIo.fsyncSync(file.fd); } finally { fileIo.closeSync(file); }
    PrivateService.initService(context, path);
  }
  static directoryBytes(path: string): number {
    if (!fileIo.accessSync(path)) return 0;
    try {
      const stat = fileIo.statSync(path); if (stat.isFile()) return stat.size;
      return fileIo.listFileSync(path).reduce((sum: number, name: string) => sum + AliyunSecureCacheDriver.directoryBytes(path + '/' + name), 0);
    } catch { return Number.MAX_VALUE; }
  }
  private worker?: AliMediaDownloader;
  private guardTimer: number = -1;
  private allowed: () => boolean = () => false;
  private callbacks?: CacheDownloadCallbacks;
  private context: common.UIAbilityContext;
  constructor(context: common.UIAbilityContext) { this.context = context; }
  async configured(): Promise<boolean> {
    try {
      const metadata = this.context.currentHapModuleInfo.metadata || [];
      const key = metadata.find((item) => item.name === 'com.aliyun.alivc_license.licensekey')?.value || '';
      const cert = metadata.find((item) => item.name === 'com.aliyun.alivc_license.licensefile')?.value || '';
      if (!key || !cert) return false;
      const secret = await this.context.resourceManager.getRawFileContent('encryptedApp.dat');
      const license = await this.context.resourceManager.getRawFileContent(cert);
      return secret.length > 0 && license.length > 0;
    } catch { return false; }
  }
  async start(vod: string, playAuth: string, directory: string, maximumBytes: number, allowed: () => boolean, callbacks: CacheDownloadCallbacks): Promise<void> {
    if (!await this.configured() || !allowed() || !playAuth || maximumBytes <= 0) throw new Error('安全离线观看尚未开放');
    if (!directory.startsWith(this.context.filesDir + '/course-cache/') || directory.includes('..')) throw new Error('离线目录无效');
    this.stop(); fileIo.mkdirSync(directory, true);
    await AliyunSecureCacheDriver.initializeKey(this.context);
    if (!allowed()) throw new Error('离线观看授权已变化');
    Logger.getInstance(this.context).enableConsoleLog(false);
    this.allowed = allowed; this.callbacks = callbacks;
    const active = AliDownloaderFactory.create(this.context); this.worker = active; active.setSaveDir(directory);
    active.setOnPreparedListener({ onPrepared: (info: MediaInfo) => {
      if (this.worker !== active) return;
      if (!this.allowed()) { this.fail('离线观看授权已变化'); return; }
      const tracks = info.getTrackInfos().filter((track: TrackInfo) => ['m3u8', 'mp4'].includes(track.getVodFormat()) && track.getVodFileSize() > 0 && track.getVodFileSize() <= maximumBytes).sort((a: TrackInfo, b: TrackInfo) => a.getVodFileSize() - b.getVodFileSize());
      if (!tracks.length) { this.fail('没有可安全下载的清晰度或空间不足'); return; }
      active.selectItem(tracks[0].getIndex()); active.start();
    } });
    active.setOnProgressListener({ onDownloadingProgress: (percent: number) => { if (this.worker !== active) return; if (this.allowed()) callbacks.progress(percent); else this.fail('离线观看授权待联网更新'); }, onProcessingProgress: (_percent: number) => {} });
    active.setOnErrorListener({ onError: (_error: ErrorInfo) => { if (this.worker === active) this.fail('安全下载失败，请联网重试'); } });
    active.setOnCompletionListener({ onCompletion: () => {
      if (this.worker !== active) return;
      const path = active.getFilePath();
      try {
        const stat = fileIo.statSync(path);
        if (!this.allowed() || !path.startsWith(directory + '/') || path.includes('..') || !stat.isFile() || stat.size <= 0 || AliyunSecureCacheDriver.directoryBytes(directory) > maximumBytes) { this.fail('离线文件或授权无效'); return; }
        this.stop(); callbacks.complete(path);
      } catch { this.fail('无法安全保存离线内容'); }
    } });
    const source = new VidAuth(); source.setVid(vod); source.setPlayAuth(playAuth); active.prepareVidAuth(source);
    this.guardTimer = setInterval(() => { if (this.worker && !this.allowed()) this.fail('离线观看授权待联网更新'); else if (this.worker && AliyunSecureCacheDriver.directoryBytes(directory) > maximumBytes) this.fail('下载超出容量限制，请删除不需要的离线内容'); }, 1000);
  }
  stop(): void { if (this.guardTimer >= 0) clearInterval(this.guardTimer); this.guardTimer = -1; this.worker?.stop(); this.worker?.release(); this.worker = undefined; this.allowed = () => false; this.callbacks = undefined; }
  private fail(message: string): void { const callbacks = this.callbacks; this.worker?.deleteFile(); this.stop(); callbacks?.failure(message); }
}
