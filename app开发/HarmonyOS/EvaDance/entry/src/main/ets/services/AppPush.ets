import { common, Want } from '@kit.AbilityKit';
import { notificationManager } from '@kit.NotificationKit';
import { pushService } from '@kit.PushKit';
import { preferences } from '@kit.ArkData';
import { util } from '@kit.ArkTS';
import { http } from '@kit.NetworkKit';
import { aliyunPush, PushNotificationHandler, Channel, PushNotification, PushMessage, ExtensionNotification } from '@aliyun/push';
import { platform } from './PlatformApi';

interface PushConfiguration { appKey: string; appSecret: string; }
interface PushFlags { enabled: boolean; }
interface PushCapability { push?: PushFlags; }
interface PushDevice { installationId: string; deviceId: string; enabled: boolean; }
class PushClick implements PushNotificationHandler {
  onClickNotification(data: PushNotification | PushMessage | ExtensionNotification, from: Channel): void {
    // Only open the canonical message list. No remote URL is trusted or opened.
    if (platform.credentials) appPush.openMessages = true;
  }
  noPushData(): void {}
}
class AppPush {
  private context?: common.UIAbilityContext;
  private initialized: boolean = false;
  private running: boolean = false;
  private boundSession: string = '';
  private pendingWant?: Want;
  openMessages: boolean = false;
  status: string = '未开启系统通知';
  configure(context: common.UIAbilityContext, want?: Want): void { this.context = context; platform.notificationInvalidation = (id: string) => { this.revoke(id); this.clear(); }; if (want) this.pendingWant = want; }
  handle(want: Want): void { this.pendingWant = want; if (this.initialized) aliyunPush.handleClickNotification(want, new PushClick()); }
  async enable(): Promise<void> {
    if (!this.context || !platform.credentials) { this.status = '请先登录后开启通知'; return; }
    try {
      const capability = await platform.request<PushCapability>('/config');
      if (!capability.push?.enabled) { this.status = '系统通知配置中，App 内消息继续保留'; return; }
      await notificationManager.requestEnableNotification(this.context);
      if (!await notificationManager.isNotificationEnabled()) { this.status = '系统通知未允许'; return; }
      const settings = preferences.getPreferencesSync(this.context, { name: 'push-settings' });
      settings.putSync('enabled', true); await settings.flush();
      await this.refresh();
    } catch { this.status = '通知暂不可用，请稍后重试'; }
  }
  private revoke(id: string): void {
    if (!this.context || !id) return;
    const settings = preferences.getPreferencesSync(this.context, { name: 'push-settings' });
    const prior = JSON.parse(settings.getSync('revocations', '[]') as string) as string[];
    if (!prior.includes(id)) prior.push(id);
    settings.putSync('revocations', JSON.stringify(prior.slice(-20))); settings.flush().then(() => { this.flushRevocations(); });
  }
  private async flushRevocations(): Promise<void> {
    if (!this.context) return;
    const settings = preferences.getPreferencesSync(this.context, { name: 'push-settings' });
    const installation = settings.getSync('installation', '') as string;
    const prior = JSON.parse(settings.getSync('revocations', '[]') as string) as string[];
    if (!installation) return;
    for (const id of prior) {
      try {
        await platform.request<Object>('/push/unbind', http.RequestMethod.POST, { installationId: installation, pushSessionId: id });
        const current = JSON.parse(settings.getSync('revocations', '[]') as string) as string[];
        settings.putSync('revocations', JSON.stringify(current.filter((value: string) => value !== id))); await settings.flush();
      } catch { return; }
    }
  }
  async refresh(): Promise<void> {
    await this.flushRevocations();
    if (this.running || !this.context || !platform.credentials) return;
    const binding = platform.credentials.sessionId;
    if (!await notificationManager.isNotificationEnabled()) { this.revoke(binding); this.clear(); this.status = '系统通知未允许'; return; }
    if (binding === this.boundSession) return;
    const settings = preferences.getPreferencesSync(this.context, { name: 'push-settings' });
    if (settings.getSync('enabled', false) !== true || !await notificationManager.isNotificationEnabled()) return;
    this.running = true;
    try {
      const capability = await platform.request<PushCapability>('/config');
      if (!capability.push?.enabled) { this.status = '系统通知配置中，App 内消息继续保留'; return; }
      const settings = preferences.getPreferencesSync(this.context, { name: 'push-settings' });
      let installation = settings.getSync('installation', '') as string;
      if (!/^[a-f0-9]{64}$/.test(installation)) { installation = (util.generateRandomUUID() + util.generateRandomUUID()).replace(/-/g, '').toLowerCase(); settings.putSync('installation', installation); await settings.flush(); }
      await platform.request<Object>('/push/permits', http.RequestMethod.POST, { installationId: installation }, true);
      if (platform.credentials?.sessionId !== binding) return;
      if (!this.initialized) {
        const bytes = await this.context.resourceManager.getRawFileContent('push.local.json');
        const config = JSON.parse(new util.TextDecoder().decodeWithStream(bytes)) as PushConfiguration;
        if (!config.appKey || !config.appSecret) { this.status = '通知配置尚未完成'; return; }
        aliyunPush.init({ appKey: config.appKey, appSecret: config.appSecret, context: this.context, allowBackgroundConnection: false });
        this.initialized = true;
        if (this.pendingWant) aliyunPush.handleClickNotification(this.pendingWant, new PushClick());
      }
      await aliyunPush.register();
      // System Push Kit is essential when the application is frozen or killed.
      const token = await pushService.getToken();
      await aliyunPush.registerThirdToken(token);
      if (platform.credentials?.sessionId !== binding) return;
      const deviceId = aliyunPush.getDeviceId();
      if (!deviceId) { this.status = '通知设备注册失败'; return; }
      await platform.request<Object>('/push/devices', http.RequestMethod.PUT, { installationId: installation, deviceId: deviceId, enabled: true }, true);
      if (platform.credentials?.sessionId === binding) { this.boundSession = binding; this.status = '系统通知已连接'; }
    } catch { this.status = '通知连接失败，可在 App 内查看消息'; }
    finally { this.running = false; }
  }
  clear(): void { this.boundSession = ''; this.openMessages = false; notificationManager.cancelAll().catch(() => {}); notificationManager.setBadgeNumber(0).catch(() => {}); }
}
export const appPush: AppPush = new AppPush();
