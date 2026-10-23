import crypto from 'crypto';

export const dynamic = 'force-dynamic';

type CachedValue<T> = {
  value: T;
  expiresAt: number;
};

let accessTokenCache: CachedValue<string> | null = null;
let jsapiTicketCache: CachedValue<string> | null = null;

function jsonError(message: string, status = 500) {
  return Response.json({ success: false, message }, { status });
}

function randomNonce() {
  return crypto.randomBytes(12).toString('hex');
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' });
  const payload = await response.json();
  if (!response.ok || payload.errcode) {
    throw new Error(payload.errmsg || `微信接口请求失败 (${response.status})`);
  }
  return payload as T;
}

async function getAccessToken(appId: string, appSecret: string) {
  const now = Date.now();
  if (accessTokenCache && accessTokenCache.expiresAt > now) return accessTokenCache.value;
  const payload = await fetchJson<{ access_token: string; expires_in?: number }>(
    `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(appId)}&secret=${encodeURIComponent(appSecret)}`,
  );
  if (!payload.access_token) throw new Error('微信 access_token 为空');
  accessTokenCache = {
    value: payload.access_token,
    expiresAt: now + Math.max(300, Number(payload.expires_in || 7200) - 300) * 1000,
  };
  return accessTokenCache.value;
}

async function getJsapiTicket(accessToken: string) {
  const now = Date.now();
  if (jsapiTicketCache && jsapiTicketCache.expiresAt > now) return jsapiTicketCache.value;
  const payload = await fetchJson<{ ticket: string; expires_in?: number }>(
    `https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token=${encodeURIComponent(accessToken)}&type=jsapi`,
  );
  if (!payload.ticket) throw new Error('微信 jsapi_ticket 为空');
  jsapiTicketCache = {
    value: payload.ticket,
    expiresAt: now + Math.max(300, Number(payload.expires_in || 7200) - 300) * 1000,
  };
  return jsapiTicketCache.value;
}

export async function GET(request: Request) {
  try {
    const appId = process.env.WECHAT_MP_APP_ID || process.env.WECHAT_APP_ID || '';
    const appSecret = process.env.WECHAT_MP_APP_SECRET || process.env.WECHAT_APP_SECRET || '';
    if (!appId || !appSecret) {
      return jsonError('未配置微信公众号 WECHAT_MP_APP_ID / WECHAT_MP_APP_SECRET', 503);
    }

    const url = new URL(request.url).searchParams.get('url') || '';
    let parsed: URL;
    try { parsed = new URL(url); } catch { return jsonError('url 参数无效', 400); }
    if (parsed.protocol !== 'https:' || !['www.swod.com.cn', 'swod.com.cn'].includes(parsed.hostname)
      || parsed.port || parsed.username || parsed.password || parsed.hash) return jsonError('url 参数无效', 400);

    const accessToken = await getAccessToken(appId, appSecret);
    const jsapiTicket = await getJsapiTicket(accessToken);
    const timestamp = Math.floor(Date.now() / 1000);
    const nonceStr = randomNonce();
    const signatureBase = [
      `jsapi_ticket=${jsapiTicket}`,
      `noncestr=${nonceStr}`,
      `timestamp=${timestamp}`,
      `url=${url}`,
    ].join('&');
    const signature = crypto.createHash('sha1').update(signatureBase).digest('hex');

    return Response.json({
      appId,
      timestamp,
      nonceStr,
      signature,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : '微信签名生成失败');
  }
}
