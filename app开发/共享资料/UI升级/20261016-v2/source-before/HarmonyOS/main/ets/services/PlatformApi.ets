import { http } from '@kit.NetworkKit';
import { util } from '@kit.ArkTS';
import { Credentials, StaffCredentials, Envelope, WriteBody } from './Models';

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
export function publicRead(path: string, method: http.RequestMethod): boolean {
  return method === http.RequestMethod.GET && /^\/(public\/(series(\/[1-9][0-9]*(\/(courses|detail))?)?|offline-courses|calendar|home-stats)|events(\/[1-9][0-9]*)?)$/.test(path.split('?')[0]);
}
export function safePath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//') && !path.includes('..') && !path.includes('://') && !path.includes('\\') && !/%(2f|2e|5c)/i.test(path);
}
export function secureMedia(url: string): boolean {
  return /^https:\/\/[^\s\/@:?#]+(:443)?(\/|\?|#|$)/.test(url);
}
/** Memory-only sessions until the HUKS credential vault has passed device acceptance. */
export class PlatformApi {
  credentials?: Credentials;
  staff?: StaffCredentials;
  private generation: number = 0;
  private refreshing?: Promise<Credentials>;
  async login(phone: string, code: string): Promise<void> {
    const value = await this.request<Credentials>('/auth/login', http.RequestMethod.POST, { phone: phone, code: code, deviceName: '伊娃东方舞 HarmonyOS' });
    this.generation++; this.credentials = value;
  }
  clear(): void { this.generation++; this.credentials = undefined; }
  async logout(): Promise<void> {
    const token = this.credentials?.token; this.clear();
    if (token) await this.exchange<Object>(API, '/auth/logout', http.RequestMethod.POST, {}, token);
  }
  async loginStaff(username: string, password: string): Promise<void> {
    const value = await this.raw<StaffCredentials>(MANAGEMENT_API, '/login', http.RequestMethod.POST, { username: username, password: password });
    if (!value.token || !['admin', 'event_admin'].includes(value.user.role)) throw new PlatformFailure('当前账号没有赛事管理权限', 403);
    this.staff = value;
  }
  async staffRequest<T>(path: string, method: http.RequestMethod = http.RequestMethod.GET, body?: WriteBody): Promise<T> {
    if (!this.staff || !path.startsWith('/event/')) throw new PlatformFailure('请使用工作人员账号登录', 401);
    const token = this.staff.token;
    try { return await this.exchange<T>(MANAGEMENT_API, path, method, body, token); }
    catch (error) { if (error instanceof PlatformFailure && error.status === 401 && this.staff?.token === token) this.staff = undefined; throw error; }
  }
  async request<T>(path: string, method: http.RequestMethod = http.RequestMethod.GET, body?: WriteBody, authenticated: boolean = false): Promise<T> {
    const token = authenticated ? this.credentials?.token : undefined;
    const generation = this.generation;
    if (authenticated && !token) throw new PlatformFailure('请先登录', 401);
    try { return await this.exchange<T>(!authenticated && publicRead(path, method) ? PUBLIC_API : API, path, method, body, token); }
    catch (error) {
      if (!(error instanceof PlatformFailure) || error.status !== 401 || !token) throw error;
      if (!this.credentials || generation !== this.generation) throw new PlatformFailure('账号已切换，请重新打开页面', 401);
      if (this.credentials.token === token) {
        if (!this.refreshing) this.refreshing = this.exchange<Credentials>(API, '/auth/refresh', http.RequestMethod.POST, { refreshToken: this.credentials.refreshToken });
        try {
          const renewed = await this.refreshing;
          if (generation !== this.generation) throw new PlatformFailure('账号已退出', 401);
          this.credentials = renewed;
        } catch (failure) { if (failure instanceof PlatformFailure && failure.status === 401) this.clear(); throw failure; }
        finally { this.refreshing = undefined; }
      }
      return this.exchange<T>(API, path, method, body, this.credentials.token);
    }
  }
  async registerWithMusic(eventID: number, fields: Record<string, string>, name: string, music: ArrayBuffer): Promise<void> {
    if (!this.credentials || music.byteLength === 0 || music.byteLength > 10 * 1024 * 1024) throw new PlatformFailure('请登录并选择10MB以内的音乐文件', 400);
    const boundary = 'EvaMusic-' + util.generateRandomUUID();
    const encoder = new util.TextEncoder();
    const pieces: Uint8Array[] = [];
    const allowed: string[] = ['groupId', 'name', 'phone', 'organization', 'teacher', 'performanceTitle', 'remark'];
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
    const version = this.generation; const path = '/events/' + eventID + '/register';
    try { await this.exchange<Object>(API, path, http.RequestMethod.POST, data.buffer, this.credentials.token, 'multipart/form-data; boundary=' + boundary); }
    catch (failure) {
      if (!(failure instanceof PlatformFailure) || failure.status !== 401) throw failure;
      await this.request<Object>('/member/profile', http.RequestMethod.GET, undefined, true);
      if (!this.credentials || version !== this.generation) throw new PlatformFailure('账号已切换，请重新打开报名页面', 401);
      await this.exchange<Object>(API, path, http.RequestMethod.POST, data.buffer, this.credentials.token, 'multipart/form-data; boundary=' + boundary);
    }
  }

  private async exchange<T>(base: string, path: string, method: http.RequestMethod, body?: WriteBody | ArrayBuffer, token?: string, contentType: string = 'application/json'): Promise<T> {
    const response = await this.raw<Envelope<T>>(base, path, method, body, token, contentType);
    if (!response.success) throw new PlatformFailure(response.message || response.error || '请求未完成', 400);
    return response.data as T;
  }
  private async raw<T>(base: string, path: string, method: http.RequestMethod, body?: WriteBody | ArrayBuffer, token?: string, contentType: string = 'application/json'): Promise<T> {
    if (!safePath(path)) throw new PlatformFailure('接口地址无效', 400);
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
