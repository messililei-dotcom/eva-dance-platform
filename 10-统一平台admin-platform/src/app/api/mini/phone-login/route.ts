import { loginData, upsertPhoneMember } from '../_auth';
import { cleanText, getMemberId, jsonError, withDb } from '../_helpers';

type PhoneInfo = {
  phoneNumber?: string;
  purePhoneNumber?: string;
};

type WechatAccessTokenCache = {
  appId: string;
  token: string;
  expiresAt: number;
};

type WechatApiResponse = Record<string, any> & {
  errcode?: number;
  errmsg?: string;
};

class PhoneLoginError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'PhoneLoginError';
    this.status = status;
  }
}

const ACCESS_TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;
const RETRYABLE_ACCESS_TOKEN_CODES = new Set([40001, 40014, 42001]);

let accessTokenCache: WechatAccessTokenCache | null = null;
let accessTokenPromise: Promise<string> | null = null;

function getWechatConfig() {
  const appId = cleanText(process.env.WECHAT_MINIAPP_APP_ID || process.env.WECHAT_MINIAPP_APPID || process.env.NEXT_PUBLIC_WECHAT_MINIAPP_ID);
  const secret = cleanText(process.env.WECHAT_MINIAPP_SECRET || process.env.WX_MINIAPP_SECRET);
  if (!appId || !secret) throw new PhoneLoginError('微信登录服务暂不可用，请联系管理员');
  return { appId, secret };
}

async function readWechatJson(res: Response) {
  const text = await res.text();
  if (!text) return {} as WechatApiResponse;
  try {
    return JSON.parse(text) as WechatApiResponse;
  } catch {
    throw new PhoneLoginError('微信服务响应异常，请稍后再试');
  }
}

function wechatErrorMessage(data: WechatApiResponse, fallback: string) {
  switch (Number(data.errcode || 0)) {
    case 40001:
    case 40014:
    case 42001:
      return '微信登录凭证已刷新，请重新授权';
    case 40029:
    case 40163:
      return '手机号授权已失效，请重新点击一键登录';
    case 40125:
    case 40164:
    case 41002:
    case 41004:
      return '微信登录服务暂不可用，请联系管理员';
    case 45009:
      return '微信登录请求过于频繁，请稍后再试';
    default:
      return fallback;
  }
}

function logWechatError(scope: string, data: WechatApiResponse) {
  if (data.errcode || data.errmsg) {
    console.warn(`[mini/phone-login] ${scope}`, { errcode: data.errcode, errmsg: data.errmsg });
  }
}

async function fetchAccessToken(appId: string, secret: string) {
  const url = new URL('https://api.weixin.qq.com/cgi-bin/token');
  url.searchParams.set('grant_type', 'client_credential');
  url.searchParams.set('appid', appId);
  url.searchParams.set('secret', secret);

  let res: Response;
  try {
    res = await fetch(url, { cache: 'no-store' });
  } catch {
    throw new PhoneLoginError('微信服务连接失败，请稍后再试');
  }

  const data = await readWechatJson(res);
  if (!res.ok || data.errcode || !data.access_token) {
    logWechatError('access_token error', data);
    throw new PhoneLoginError(wechatErrorMessage(data, '获取微信登录凭证失败，请稍后再试'), Number(data.errcode) === 45009 ? 429 : 400);
  }

  const expiresIn = Number(data.expires_in);
  const expiresInSeconds = Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 7200;
  accessTokenCache = {
    appId,
    token: String(data.access_token),
    expiresAt: Date.now() + expiresInSeconds * 1000,
  };
  return accessTokenCache.token;
}

async function getAccessToken(forceRefresh = false) {
  const { appId, secret } = getWechatConfig();
  const now = Date.now();

  if (!forceRefresh
    && accessTokenCache?.appId === appId
    && accessTokenCache.expiresAt - ACCESS_TOKEN_REFRESH_BUFFER_MS > now) {
    return accessTokenCache.token;
  }

  if (!forceRefresh && accessTokenPromise) return accessTokenPromise;

  accessTokenPromise = fetchAccessToken(appId, secret).finally(() => {
    accessTokenPromise = null;
  });
  return accessTokenPromise;
}

async function requestWechatPhone(code: string, accessToken: string) {
  let res: Response;
  try {
    res = await fetch(`https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${encodeURIComponent(accessToken)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code }),
      cache: 'no-store',
    });
  } catch {
    throw new PhoneLoginError('微信服务连接失败，请稍后再试');
  }

  const data = await readWechatJson(res);
  return { res, data };
}

async function getWechatPhone(code: string) {
  if (!code) throw new PhoneLoginError('请先授权手机号');

  let accessToken = await getAccessToken();
  let { res, data } = await requestWechatPhone(code, accessToken);

  if ((!res.ok || data.errcode) && RETRYABLE_ACCESS_TOKEN_CODES.has(Number(data.errcode || 0))) {
    accessTokenCache = null;
    accessToken = await getAccessToken(true);
    ({ res, data } = await requestWechatPhone(code, accessToken));
  }

  if (!res.ok || data.errcode) {
    logWechatError('getuserphonenumber error', data);
    throw new PhoneLoginError(wechatErrorMessage(data, '微信手机号授权失败，请稍后重试'), Number(data.errcode) === 45009 ? 429 : 400);
  }

  const info = (data.phone_info || {}) as PhoneInfo;
  const phone = cleanText(info.purePhoneNumber || info.phoneNumber);
  if (!/^1\d{10}$/.test(phone)) throw new PhoneLoginError('微信未返回有效手机号，请使用验证码登录');
  return phone;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const currentMemberId = getMemberId(new URL(request.url).searchParams, request);
    const code = cleanText(body.code);
    const previewPhone = cleanText(body.previewPhone);
    const usePreviewPhone = previewPhone && process.env.NODE_ENV !== 'production';
    if (!usePreviewPhone && !code) return jsonError('请先授权手机号', 400);

    const phone = usePreviewPhone ? previewPhone : await getWechatPhone(code);
    if (!/^1\d{10}$/.test(phone)) return jsonError('请输入正确的手机号', 400);

    return withDb((db) => {
      const member = upsertPhoneMember(db, phone, {
        sourceMemberId: currentMemberId,
        source: 'wechat_phone',
      });
      return Response.json({
        success: true,
        data: loginData(member),
      });
    });
  } catch (err: any) {
    if (err instanceof PhoneLoginError) return jsonError(err.message, err.status);
    return jsonError(err.message);
  }
}
