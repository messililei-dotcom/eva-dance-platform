type WechatAccessToken = {
  access_token?: string;
  expires_in?: number;
  errcode?: number;
  errmsg?: string;
};

type WechatUrlLink = {
  url_link?: string;
  errcode?: number;
  errmsg?: string;
};

type WechatUrlScheme = {
  openlink?: string;
  errcode?: number;
  errmsg?: string;
};

let cachedToken = '';
let cachedTokenExpiresAt = 0;

function cleanText(value: unknown) {
  return String(value ?? '').trim();
}

function config() {
  const appId = cleanText(process.env.WECHAT_MINIAPP_APP_ID || process.env.NEXT_PUBLIC_WECHAT_MINIAPP_ID);
  const secret = cleanText(process.env.WECHAT_MINIAPP_SECRET || process.env.WX_MINIAPP_SECRET);
  if (process.env.WECHAT_MINIAPP_HANDOFF_ENABLED !== 'true' || !appId || !secret) {
    throw new Error('小程序一键登录尚未配置');
  }
  return { appId, secret };
}

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.text();
  if (!body) return {} as T;
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error('微信服务响应异常');
  }
}

async function accessToken(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedToken && cachedTokenExpiresAt > now + 60_000) return cachedToken;
  const { appId, secret } = config();
  const response = await fetch('https://api.weixin.qq.com/cgi-bin/stable_token', {
    method: 'POST',
    cache: 'no-store',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credential',
      appid: appId,
      secret,
      force_refresh: forceRefresh,
    }),
  });
  const result = await readJson<WechatAccessToken>(response);
  if (!response.ok || result.errcode || !result.access_token) {
    console.warn('[wechat/mini-handoff] access token error', { errcode: result.errcode, errmsg: result.errmsg });
    throw new Error('微信小程序连接暂不可用');
  }
  cachedToken = result.access_token;
  cachedTokenExpiresAt = now + Math.max(300, Number(result.expires_in || 7200) - 300) * 1000;
  return cachedToken;
}

async function requestUrlLink(token: string, handoffId: string) {
  const endpoint = new URL('https://api.weixin.qq.com/wxa/generate_urllink');
  endpoint.searchParams.set('access_token', token);
  const response = await fetch(endpoint, {
    method: 'POST',
    cache: 'no-store',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      // 使用微信当前已发布版本的默认首页，避免发布前后页面路径差异导致 URL Link 失效。
      query: `pwa_handoff=${encodeURIComponent(handoffId)}`,
      env_version: process.env.WECHAT_MINIAPP_ENV_VERSION === 'trial' ? 'trial' : 'release',
      is_expire: true,
      expire_type: 1,
      expire_interval: 1,
    }),
  });
  return { response, result: await readJson<WechatUrlLink>(response) };
}

async function requestUrlScheme(token: string, handoffId: string) {
  const endpoint = new URL('https://api.weixin.qq.com/wxa/generatescheme');
  endpoint.searchParams.set('access_token', token);
  const response = await fetch(endpoint, {
    method: 'POST',
    cache: 'no-store',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jump_wxa: {
        query: `pwa_handoff=${encodeURIComponent(handoffId)}`,
        env_version: process.env.WECHAT_MINIAPP_ENV_VERSION === 'trial' ? 'trial' : 'release',
      },
      is_expire: true,
      expire_type: 1,
      expire_interval: 1,
    }),
  });
  return { response, result: await readJson<WechatUrlScheme>(response) };
}

function invalidToken(errcode: unknown) {
  return [40001, 40014, 42001].includes(Number(errcode || 0));
}

async function refreshAccessToken() {
  cachedToken = '';
  cachedTokenExpiresAt = 0;
  return accessToken(true);
}

async function createMiniAppLoginUrlScheme(handoffId: string) {
  let token = await accessToken();
  let { response, result } = await requestUrlScheme(token, handoffId);
  if (invalidToken(result.errcode)) {
    token = await refreshAccessToken();
    ({ response, result } = await requestUrlScheme(token, handoffId));
  }
  if (!response.ok || result.errcode || !result.openlink) {
    console.warn('[wechat/mini-handoff] URL Scheme error', { errcode: result.errcode, errmsg: result.errmsg });
    return '';
  }
  return result.openlink;
}

export async function createMiniAppLoginUrlLink(handoffId: string) {
  const scheme = await createMiniAppLoginUrlScheme(handoffId);
  if (scheme) return scheme;

  let token = await accessToken();
  let { response, result } = await requestUrlLink(token, handoffId);
  if (invalidToken(result.errcode)) {
    token = await refreshAccessToken();
    ({ response, result } = await requestUrlLink(token, handoffId));
  }
  if (!response.ok || result.errcode || !result.url_link) {
    console.warn('[wechat/mini-handoff] URL Link error', { errcode: result.errcode, errmsg: result.errmsg });
    throw new Error('暂时无法唤起微信小程序');
  }
  return result.url_link;
}
