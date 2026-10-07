import { createHmac, randomUUID } from 'node:crypto';
import { AppError } from './app-session';
export const carrierLoginEnabled = () => process.env.APP_ONE_TAP_ENABLED === 'true'
  && Boolean(process.env.ALIYUN_ACCESS_KEY_ID && process.env.ALIYUN_ACCESS_KEY_SECRET);
const encode = (value: string) => encodeURIComponent(value).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
// Token is obtained only through the operator authorization page. Never trust a client-supplied phone.
export async function getCarrierPhone(accessToken: unknown, transport: typeof fetch = fetch): Promise<string> {
  if (!carrierLoginEnabled()) throw new AppError('本机号码登录暂未开放，请使用短信验证码', 503);
  if (typeof accessToken !== 'string' || accessToken.length < 16 || accessToken.length > 8192 || /\s/.test(accessToken))
    throw new AppError('号码认证凭据无效');
  const params: Record<string, string> = {
    Action: 'GetMobile', Version: '2017-05-25', Format: 'JSON', RegionId: 'cn-hangzhou',
    AccessKeyId: process.env.ALIYUN_ACCESS_KEY_ID!, AccessToken: accessToken,
    SignatureMethod: 'HMAC-SHA1', SignatureVersion: '1.0', SignatureNonce: randomUUID(),
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  };
  const canonical = Object.keys(params).sort().map(key => `${encode(key)}=${encode(params[key])}`).join('&');
  params.Signature = createHmac('sha1', process.env.ALIYUN_ACCESS_KEY_SECRET! + '&')
    .update(`POST&%2F&${encode(canonical)}`).digest('base64');
  try {
    const result = await transport('https://dypnsapi.aliyuncs.com/', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(), signal: AbortSignal.timeout(10_000), redirect: 'error', cache: 'no-store',
    });
    const payload = await result.json();
    const phone = payload?.GetMobileResultDTO?.Mobile;
    if (!result.ok || payload.Code !== 'OK' || typeof phone !== 'string' || !/^1[0-9]{10}$/.test(phone))
      throw new AppError('号码认证未通过，请重新授权或使用短信登录', 401);
    return phone;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('号码认证服务暂不可用，请使用短信登录', 503);
  }
}
