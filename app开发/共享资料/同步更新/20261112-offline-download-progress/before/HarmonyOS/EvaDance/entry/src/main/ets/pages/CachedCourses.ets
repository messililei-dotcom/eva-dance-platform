import { common } from '@kit.AbilityKit';
import { AliPlayer, AliPlayerFactory, UrlSource, Logger, ErrorInfo } from 'premierlibrary';
import { AliyunSecureCacheDriver } from '../services/AliyunSecureCacheDriver';
import { CourseCacheStore, CachedCourse } from '../services/CourseCacheStore';
import { platform } from '../services/PlatformApi';
import { SwodTheme } from '../services/SwodTheme';

@Component
export struct CachedCourses {
  cache?: CourseCacheStore;
  @State private rows: CachedCourse[] = [];
  @State private message: string = '';
  @State private selected: number = 0;
  aboutToAppear(): void {
    if (this.cache) { this.cache.changed = () => this.reload(); this.reload(); this.cache.refresh(); }
  }
  aboutToDisappear(): void { if (this.cache) this.cache.changed = () => {}; }
  private reload(): void { if (this.cache) { this.rows = JSON.parse(JSON.stringify(this.cache.visible())) as CachedCourse[]; this.message = this.cache.message; } }
  build() {
    Column({ space: 12 }) {
      if (this.cache && this.selected > 0) {
        CachedOfflinePlayer({ cache: this.cache, lessonID: this.selected, back: () => { this.selected = 0; this.reload(); } })
      } else {
        Text('课程缓存').fontSize(22).fontWeight(FontWeight.Bold).width('100%')
        Text('联网时自动验证和续期；断网可在授权有效期内学习，最长24小时。设备重启后需要联网验证；退出账号会删除本机缓存。').fontSize(14).fontColor(SwodTheme.muted)
        if (this.message) { Text(this.message).fontSize(14).fontColor(SwodTheme.primary) }
        if (!this.rows.length) { Text('暂无缓存，请从课程播放设置中缓存课节。').fontSize(16).fontColor(SwodTheme.muted).padding(24) }
        ForEach(this.rows, (item: CachedCourse) => {
          Column({ space: 10 }) {
            Text(item.course).fontSize(12).fontColor(SwodTheme.muted).width('100%')
            Text(item.title).fontSize(17).fontWeight(FontWeight.Medium).width('100%')
            if (item.state === 'downloading') { Progress({ value: item.percent, total: 100 }); Text('正在缓存 ' + item.percent + '%').fontSize(13); Button('暂停缓存').constraintSize({ minHeight: 44 }).onClick(() => this.cache?.pause(item.id)) }
            else if (this.cache?.usable(item)) {
              Text((item.bytes / 1048576).toFixed(1) + ' MB' + (item.pending ? ' · 学习进度待自动同步' : ' · 已缓存')).fontSize(13).fontColor(SwodTheme.muted)
              Button('离线观看').constraintSize({ minHeight: 44 }).onClick(() => { this.selected = item.id; })
            } else { Text(item.state === 'ready' ? '待联网自动验证' : '缓存已暂停，可重新缓存').fontSize(14).fontColor(SwodTheme.muted)
              if (item.state === 'paused') { Button('重新缓存').constraintSize({ minHeight: 44 }).onClick(() => { this.cache?.download(item.id, item.title, item.course); }) }
            }
            Button('删除缓存').fontColor(SwodTheme.primary).backgroundColor(SwodTheme.tonal).constraintSize({ minHeight: 44 }).onClick(() => {
              this.getUIContext().getPromptAction().showDialog({ message: '删除这节课的本机缓存？', buttons: [{ text: '取消', color: '#777777' }, { text: '删除', color: '#8A2233' }] }).then((result) => { if (result.index === 1) this.cache?.remove(item.id); });
            })
          }.alignItems(HorizontalAlign.Start).padding(16).width('100%').backgroundColor(SwodTheme.surface).borderRadius(12)
        }, (item: CachedCourse) => item.nonce)
      }
    }.width('100%').alignItems(HorizontalAlign.Start)
  }
}

@Component
struct CachedOfflinePlayer {
  cache?: CourseCacheStore;
  lessonID: number = 0;
  back: () => void = () => {};
  private player?: AliPlayer;
  private surface: XComponentController = new XComponentController();
  private timer: number = -1;
  private generation: number = 0;
  private ticks: number = 0;
  private recordNonce: string = '';
  @State private ready: boolean = false;
  @State private playing: boolean = false;
  @State private message: string = '';
  @State private playbackPosition: number = 0;
  @State private duration: number = 1;
  private permits(): boolean { const item = this.cache?.get(this.lessonID); return item !== undefined && (!this.recordNonce || this.recordNonce === item.nonce) && this.cache?.usable(item) === true && platform.applicationActive && platform.screenProtected; }
  private async open(): Promise<void> {
    const item = this.cache?.get(this.lessonID); if (!item || !this.permits()) { this.message = '缓存授权或安全窗口待验证'; return; }
    this.recordNonce = item.nonce;
    const version = this.generation;
    const context = this.getUIContext().getHostContext() as common.UIAbilityContext;
    try {
      await AliyunSecureCacheDriver.initializeKey(context);
      if (version !== this.generation || !this.permits()) return;
      Logger.getInstance(context).enableConsoleLog(false);
      const player = AliPlayerFactory.createAliPlayer(context); this.player = player; player.setSurfaceId(this.surface.getXComponentSurfaceId());
      player.setOnPreparedListener({ onPrepared: () => { if (!this.permits()) { player.pause(); return; } this.duration = player.getDuration() / 1000; this.ready = true; player.seekTo(item.position * 1000, 1); } });
      player.setOnErrorListener({ onError: (_error: ErrorInfo) => { this.playing = false; this.ready = false; this.message = '安全缓存无法解密，请联网重新缓存'; } });
      player.setOnCompletionListener({ onCompletion: () => { this.playing = false; this.checkpoint(); } });
      const source = new UrlSource(); source.setUri(this.cache?.file(item) || ''); player.setUrlDataSource(source); player.prepare();
      this.timer = setInterval(() => {
        if (!this.permits()) { this.player?.pause(); this.playing = false; this.message = '缓存授权待联网自动验证'; return; }
        this.playbackPosition = (this.player?.getCurrentPosition() || 0) / 1000;
        if (++this.ticks % 15 === 0) this.checkpoint();
        if (this.message === '缓存授权待联网自动验证') this.message = '';
      }, 1000);
    } catch { this.message = '安全离线播放器尚未就绪'; }
  }
  private checkpoint(): void { if (this.cache?.get(this.lessonID)?.nonce === this.recordNonce) this.cache?.checkpoint(this.lessonID, this.playbackPosition, this.duration); }
  aboutToDisappear(): void { this.generation++; this.checkpoint(); if (this.timer >= 0) clearInterval(this.timer); this.player?.stop(); this.player?.release(); this.player = undefined; }
  build() {
    Column({ space: 14 }) {
      Button('返回缓存列表').constraintSize({ minHeight: 44 }).onClick(() => this.back())
      Stack({ alignContent: Alignment.TopStart }) {
        XComponent({ id: 'secure-course-offline', type: XComponentType.SURFACE, controller: this.surface }).width('100%').aspectRatio(16 / 9).onLoad(() => { this.open(); })
      }.width('100%')
      Text(this.cache?.get(this.lessonID)?.title || '课程缓存').fontSize(18)
      if (this.message) { Text(this.message).fontSize(14).fontColor(SwodTheme.primary) }
      Button(this.playing ? '暂停' : '播放').constraintSize({ minHeight: 44 }).enabled(this.ready && this.permits()).onClick(() => {
        if (!this.permits()) return; if (this.playing) this.player?.pause(); else this.player?.start(); this.playing = !this.playing;
      })
      Slider({ value: this.playbackPosition, min: 0, max: Math.max(1, this.duration) }).enabled(this.ready && this.permits()).onChange((value: number, mode: SliderChangeMode) => {
        if (mode === SliderChangeMode.End && this.permits()) { this.playbackPosition = value; this.player?.seekTo(value * 1000, 1); }
      })
      Text(Math.floor(this.playbackPosition) + ' / ' + Math.floor(this.duration) + ' 秒').fontSize(13).fontColor(SwodTheme.muted)
    }.width('100%')
  }
}
