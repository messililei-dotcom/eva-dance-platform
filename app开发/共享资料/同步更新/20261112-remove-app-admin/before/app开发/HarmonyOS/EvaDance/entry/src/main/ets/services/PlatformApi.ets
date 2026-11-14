import { http } from '@kit.NetworkKit';
import { rcp } from '@kit.RemoteCommunicationKit';

import { util } from '@kit.ArkTS';
import { Credentials, StaffCredentials, Envelope, WriteBody } from './Models';
import { common } from '@kit.AbilityKit';
import { HuksVault } from './HuksVault';

export type ApiMethod = http.RequestMethod | 'PATCH';

const API: string = 'https://admin.swod.com.cn/api/app/v1';
const PUBLIC_API: string = 'https://admin.swod.com.cn/api/mini';
const MANAGEMENT_API: string = 'https://admin.swod.com.cn/api';

class RejectRedirect implements http.HttpInterceptor {
  interceptorType: http.InterceptorType = http.InterceptorType.REDIRECTION;
  async interceptorHandle(context: http.HttpRequestContext, response: http.HttpResponse): Promise<boolean> { return false; }
}
export class PlatformFailure extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}
export function publicRead(path: string, method: ApiMethod): boolean {
  return method === http.RequestMethod.GET && /^\/(public\/(series(\/[1-9][0-9]*(\/(courses|detail))?)?|offline-courses|calendar|home-stats)|events(\/[1-9][0-9]*)?)$/.test(path.split('?')[0]);
}
export function safePath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//') && !path.includes('..') && !path.includes('://') && !path.includes('\\') && !/%(2f|2e|5c)/i.test(path);
}
export function secureMedia(url: string): boolean {
  return /^https:\/\/[^\s\/@:?#]+(:443)?(\/|\?|#|$)/.test(url);
}
export function coverImageURL(value: string): string {
  if (secureMedia(value)) return value;
  if (!safePath(value)) return '';
  const url = 'https://admin.swod.com.cn' + value;
  return secureMedia(url) ? url : '';
}
export function externalURLAllowed(url: string): boolean {
  return secureMedia(url) && (/^https:\/\/(www\.)?swod\.com\.cn\//.test(url) ||
    url.startsWith('https://admin.swod.com.cn/api/certificates/') || url === 'https://beian.miit.gov.cn/');
}
/** Sessions and offline inventory use separate HUKS protected vaults. */
export class PlatformApi {
  private vault?: HuksVault;
  private credentialWrites: Promise<void> = Promise.resolve();
  cacheInvalidation?: () => void;
  notificationInvalidation?: (sessionId: string) => void;
  screenProtected: boolean = false;
  protectScreen?: () => Promise<void>;
  applicationActive: boolean = true;
  async initialize(context: common.UIAbilityContext): Promise<void> {
    this.vault = new HuksVault(context.filesDir, 'member-session');
    try {
      const saved = await this.vault.read();
      if (saved) { const value = JSON.parse(saved) as Credentials; if (value.memberId > 0 && value.sessionId && value.token && value.refreshToken) this.credentials = value; }
    } catch { this.credentials = undefined; }
  }
  private commit(value: Credentials, generation: number, isCurrent: () => boolean, rotation: boolean = false): Promise<void> {
    const operation = this.credentialWrites.catch(() => {}).then(async () => {
      if (!value.token || !value.refreshToken || !value.memberId || !value.sessionId || generation !== this.generation || !isCurrent() || !this.vault) throw new PlatformFailure('登录状态无效，请重试', 401);
      if (rotation && (value.memberId !== this.credentials?.memberId || value.sessionId !== this.credentials?.sessionId)) throw new PlatformFailure('登录会话已变化', 401);
      await this.vault.save(JSON.stringify(value));
      if (generation !== this.generation || !isCurrent()) {
        await this.vault.save(this.credentials ? JSON.stringify(this.credentials) : '');
        throw new PlatformFailure('登录已取消或账号已切换', 401);
      }
      if (!rotation) { this.notificationInvalidation?.(this.credentials?.sessionId || ''); this.cacheInvalidation?.(); this.generation++; }
      this.credentials = value;
    });
    this.credentialWrites = operation.catch(() => {}); return operation;
  }
  credentials?: Credentials;
  staff?: StaffCredentials;
  private generation: number = 0;
  private refreshing?: Promise<Credentials>;
  async login(phone: string, code: string, isCurrent: () => boolean = () => true): Promise<void> {
    const generation = this.generation;
    const value = await this.request<Credentials>('/auth/login', http.RequestMethod.POST, { phone: phone, code: code, deviceName: '伊娃东方舞 HarmonyOS' });
    if (generation !== this.generation || !isCurrent()) throw new PlatformFailure('登录已取消或账号已切换，请重试', 401);
    await this.commit(value, generation, isCurrent);
  }
  async loginWithPassword(phone: string, password: string, isCurrent: () => boolean = () => true): Promise<void> {
    const generation = this.generation;
    const value = await this.request<Credentials>('/auth/password-login', http.RequestMethod.POST, { phone: phone, password: password, deviceName: '伊娃东方舞 HarmonyOS' });
    if (generation !== this.generation || !isCurrent()) throw new PlatformFailure('登录已取消或账号已切换，请重试', 401);
    await this.commit(value, generation, isCurrent);
  }
  clear(): void { this.notificationInvalidation?.(this.credentials?.sessionId || ''); this.generation++; this.credentials = undefined; this.cacheInvalidation?.(); this.vault?.save('').catch(() => {}); }
  async loginWithCarrier(accessToken: string, isCurrent: () => boolean = () => true): Promise<void> {
    const generation = this.generation;
    const value = await this.request<Credentials>('/auth/one-tap', http.RequestMethod.POST, { accessToken: accessToken, deviceName: 'SWOD HarmonyOS' });
    if (generation !== this.generation || !isCurrent()) throw new PlatformFailure('登录已取消或账号已切换，请重试', 401);
    if (!value.token || !value.refreshToken || !value.memberId) throw new PlatformFailure('登录响应无效，请重试', 502);
    await this.commit(value, generation, isCurrent);
  }
  async logout(): Promise<void> {
    const token = this.credentials?.token; this.clear();
    if (token) await this.exchange<Object>(API, '/auth/logout', http.RequestMethod.POST, {}, token);
  }
  async loginStaff(username: string, password: string): Promise<void> {
    const value = await this.raw<StaffCredentials>(MANAGEMENT_API, '/login', http.RequestMethod.POST, { username: username, password: password });
    if (!value.token || !['admin', 'event_admin'].includes(value.user.role)) throw new PlatformFailure('当前账号没有赛事管理权限', 403);
    this.staff = value;
  }
  async staffRequest<T>(path: string, method: ApiMethod = http.RequestMethod.GET, body?: WriteBody): Promise<T> {
    if (!this.staff || !path.startsWith('/event/')) throw new PlatformFailure('请使用工作人员账号登录', 401);
    const token = this.staff.token;
    try { return await this.exchange<T>(MANAGEMENT_API, path, method, body, token); }
    catch (error) { if (error instanceof PlatformFailure && error.status === 401 && this.staff?.token === token) this.staff = undefined; throw error instanceof Error ? error : new PlatformFailure('请求失败，请重试', 500); }
  }
  async request<T>(path: string, method: ApiMethod = http.RequestMethod.GET, body?: WriteBody, authenticated: boolean = false): Promise<T> {
    const token = authenticated ? this.credentials?.token : undefined;
    const generation = this.generation;
    if (authenticated && !token) throw new PlatformFailure('请先登录', 401);
    try { return await this.exchange<T>(!authenticated && publicRead(path, method) ? PUBLIC_API : API, path, method, body, token); }
    catch (error) {
      if (!(error instanceof PlatformFailure) || error.status !== 401 || !token) throw error instanceof Error ? error : new PlatformFailure('请求失败，请重试', 500);
      if (!this.credentials || generation !== this.generation) throw new PlatformFailure('账号已切换，请重新打开页面', 401);
      if (this.credentials.token === token) {
        if (!this.refreshing) this.refreshing = this.exchange<Credentials>(API, '/auth/refresh', http.RequestMethod.POST, { refreshToken: this.credentials.refreshToken });
        try {
          const renewed = await this.refreshing;
          if (generation !== this.generation) throw new PlatformFailure('账号已退出', 401);
          await this.commit(renewed, generation, () => true, true);
        } catch (failure) { if (failure instanceof PlatformFailure && failure.status === 401) this.clear(); throw failure instanceof Error ? failure : new PlatformFailure('请求失败，请重试', 500); }
        finally { this.refreshing = undefined; }
      }
      return this.exchange<T>(API, path, method, body, this.credentials.token);
    }
  }
  async registerWithMusic(eventID: number, fields: Record<string, string>, name: string, music?: ArrayBuffer): Promise<void> {
    const path = '/events/' + eventID + '/register';
    if (!music) { await this.request<Object>(path, http.RequestMethod.POST, fields, true); return; }
    await this.sendEventMusic(path, fields, name, music);
  }
  async replaceEventMusic(path: string, title: string, name: string, music: ArrayBuffer): Promise<void> {
    const fields: Record<string, string> = {};
    fields['performanceTitle'] = title;
    await this.sendEventMusic(path + '/music', fields, name, music);
  }
  private async sendEventMusic(path: string, fields: Record<string, string>, name: string, music: ArrayBuffer): Promise<void> {
    if (!this.credentials || music.byteLength === 0 || music.byteLength > 10 * 1024 * 1024) throw new PlatformFailure('请登录并选择10MB以内的音乐文件', 400);
    const boundary = 'EvaMusic-' + util.generateRandomUUID();
    const encoder = new util.TextEncoder();
    const pieces: Uint8Array[] = [];
    const allowed: string[] = ['groupId', 'name', 'phone', 'countryCode', 'organization', 'teacher', 'performanceTitle', 'remark'];
    for (const key of allowed) {
      const value = fields[key] || ''; if (value.length > 1000) throw new PlatformFailure('报名内容过长', 400);
      pieces.push(encoder.encodeInto('--' + boundary + '\r\nContent-Disposition: form-data; name="' + key + '"\r\n\r\n' + value + '\r\n'));
    }
    const safeName = name.replace(/[\r\n"\\/]/g, '_');
    pieces.push(encoder.encodeInto('--' + boundary + '\r\nContent-Disposition: form-data; name="musicFile"; filename="' + safeName + '"\r\nContent-Type: application/octet-stream\r\n\r\n'));
    pieces.push(new Uint8Array(music)); pieces.push(encoder.encodeInto('\r\n--' + boundary + '--\r\n'));
    const total = pieces.reduce((sum: number, piece: Uint8Array) => sum + piece.byteLength, 0);
    const data = new Uint8Array(total); let at: number = 0;
    pieces.forEach((piece: Uint8Array) => { data.set(piece, at); at += piece.byteLength; });
    const version = this.generation;
    try { await this.exchange<Object>(API, path, http.RequestMethod.POST, data.buffer as ArrayBuffer, this.credentials.token, 'multipart/form-data; boundary=' + boundary); }
    catch (failure) {
      if (!(failure instanceof PlatformFailure) || failure.status !== 401) throw failure instanceof Error ? failure : new PlatformFailure('请求失败，请重试', 500);
      await this.request<Object>('/member/profile', http.RequestMethod.GET, undefined, true);
      if (!this.credentials || version !== this.generation) throw new PlatformFailure('账号已切换，请重新打开报名页面', 401);
      await this.exchange<Object>(API, path, http.RequestMethod.POST, data.buffer as ArrayBuffer, this.credentials.token, 'multipart/form-data; boundary=' + boundary);
    }
  }

  private async exchange<T>(base: string, path: string, method: ApiMethod, body?: WriteBody | ArrayBuffer, token?: string, contentType: string = 'application/json'): Promise<T> {
    const response = await this.raw<Envelope<T>>(base, path, method, body, token, contentType);
    if (!response.success) throw new PlatformFailure(response.message || response.error || '请求未完成', 400);
    return response.data as T;
  }
  private async patch<T>(base: string, path: string, body?: WriteBody | ArrayBuffer, token?: string, contentType: string = 'application/json'): Promise<T> {
    // NetworkKit's RequestMethod has no PATCH. Use native RCP without redirects or a response cache.
    const session = rcp.createSession({ requestConfiguration: { transfer: { autoRedirect: false, timeout: { connectMs: 20000, transferMs: 20000 } } } });
    try {
      const headers: rcp.RequestHeaders = { 'Content-Type': contentType, 'x-client-platform': 'harmony', 'Cache-Control': 'no-store' };
      if (token) headers['Authorization'] = 'Bearer ' + token;
      const content = body instanceof ArrayBuffer ? body : JSON.stringify(body || {});
      const result = await session.fetch(new rcp.Request(base + path, 'PATCH', headers, content));
      if (result.statusCode >= 300 && result.statusCode < 400) throw new PlatformFailure('接口重定向已拦截，请重试', result.statusCode);
      if (result.body && result.body.byteLength > 2000000) throw new PlatformFailure('响应内容过大，请重试', 502);
      const payload = JSON.parse(result.toString() || '{}') as Envelope<Object>;
      if (result.statusCode < 200 || result.statusCode >= 300) throw new PlatformFailure(payload.message || payload.error || '服务暂不可用，请重试', result.statusCode);
      return payload as T;
    } finally { session.close(); }
  }

  private async raw<T>(base: string, path: string, method: ApiMethod, body?: WriteBody | ArrayBuffer, token?: string, contentType: string = 'application/json'): Promise<T> {
    if (!safePath(path)) throw new PlatformFailure('接口地址无效', 400);
    if (method === 'PATCH') return this.patch<T>(base, path, body, token, contentType);
    const request = http.createHttp();
    try {
      // API 22 intercepts before another URL is requested; never forward a login token on redirect.
      const chain = new http.HttpInterceptorChain();
      if (!chain.addChain([new RejectRedirect()]) || !chain.apply(request)) throw new PlatformFailure('安全网络组件未就绪', 503);
      const headers: Record<string, string> = { 'Content-Type': contentType, 'x-client-platform': 'harmony' };
      if (token) headers['Authorization'] = 'Bearer ' + token;
      const options: http.HttpRequestOptions = { method: method, header: headers, expectDataType: http.HttpDataType.STRING, usingCache: false, connectTimeout: 20000, readTimeout: 20000, maxLimit: 2000000 };
      if (method !== http.RequestMethod.GET) options.extraData = body instanceof ArrayBuffer ? body : JSON.stringify(body || {});
      const result = await request.request(base + path, options);
      const payload = JSON.parse(result.result as string) as Envelope<Object>;
      if (result.responseCode < 200 || result.responseCode >= 300) throw new PlatformFailure(payload.message || payload.error || '服务暂不可用，请重试', result.responseCode);
      return JSON.parse(result.result as string) as T;
    } finally { request.destroy(); }
  }
}
export const platform = new PlatformApi();
