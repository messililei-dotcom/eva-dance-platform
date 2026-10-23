import crypto from 'node:crypto';

export const PAY_IDENTITY_COOKIE = '__Host-eva-wx-pay';
export const PAY_STATE_COOKIE = '__Host-eva-wx-state';
export function sealPayState(value: Record<string, unknown>, ttl: number) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error('支付授权服务尚未配置');
  const payload = Buffer.from(JSON.stringify({...value, exp: Date.now() + ttl})).toString('base64url');
  return payload + '.' + crypto.createHmac('sha256', secret).update('shop-pay:' + payload).digest('base64url');
}
export function readPayState(value: string): Record<string, any> | null {
  try {
    const secret = process.env.ADMIN_SESSION_SECRET;
    if (!secret || value.length > 4096) return null;
    const parts = value.split('.');
    if (parts.length !== 2) return null;
    const [payload, signature] = parts;
    const expected = crypto.createHmac('sha256', secret).update('shop-pay:' + payload).digest();
    const actual = Buffer.from(signature, 'base64url');
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return Number.isFinite(data.exp) && data.exp > Date.now() ? data : null;
  } catch { return null; }
}
export function payCookie(request: Request, name: string) {
  return (request.headers.get('cookie') || '').split(';').map(v => v.trim()).find(v => v.startsWith(name + '='))?.slice(name.length + 1) || '';
}
export function payerOpenid(request: Request, memberId: number, appId: string) {
  const data = readPayState(payCookie(request, PAY_IDENTITY_COOKIE));
  return data?.kind === 'payer' && data.memberId === memberId && data.appId === appId && typeof data.openid === 'string' ? data.openid : '';
}
