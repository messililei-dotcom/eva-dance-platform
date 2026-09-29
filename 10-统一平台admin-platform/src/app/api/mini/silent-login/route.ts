import { canonicalMember, loginData } from '../_auth';
import { cleanText, jsonError, withDb } from '../_helpers';
import { createWelcomeMessage } from '@/lib/server/inbox';
import { bindWechatIdentity, resolveWechatMember } from '@/lib/server/wechat-identity';

type WechatSession = {
  openid?: string;
  unionid?: string;
  session_key?: string;
  errcode?: number;
  errmsg?: string;
};

const WECHAT_FETCH_TIMEOUT_MS = 6000;

class SilentLoginError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'SilentLoginError';
    this.status = status;
  }
}

async function fetchWechat(url: URL) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WECHAT_FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { cache: 'no-store', signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function getWechatConfig() {
  const appId = cleanText(process.env.WECHAT_MINIAPP_APP_ID || process.env.WECHAT_MINIAPP_APPID || process.env.NEXT_PUBLIC_WECHAT_MINIAPP_ID);
  const secret = cleanText(process.env.WECHAT_MINIAPP_SECRET || process.env.WX_MINIAPP_SECRET);
  if (!appId || !secret) throw new SilentLoginError('微信登录服务暂不可用，请联系管理员', 503);
  return { appId, secret };
}

async function readWechatJson(res: Response) {
  const text = await res.text();
  if (!text) return {} as WechatSession;
  try {
    return JSON.parse(text) as WechatSession;
  } catch {
    throw new SilentLoginError('微信服务响应异常，请稍后再试', 502);
  }
}

function wechatErrorMessage(data: WechatSession) {
  switch (Number(data.errcode || 0)) {
    case 40029:
    case 40163:
      return '微信登录凭证已失效，请重新进入小程序';
    case 40125:
    case 40164:
    case 41002:
    case 41004:
      return '微信登录服务暂不可用，请联系管理员';
    case 45011:
    case 45009:
      return '微信登录请求过于频繁，请稍后再试';
    default:
      return '微信静默登录失败，请稍后再试';
  }
}

async function getWechatSession(code: string) {
  if (!code) throw new SilentLoginError('缺少微信登录凭证');
  const { appId, secret } = getWechatConfig();
  const url = new URL('https://api.weixin.qq.com/sns/jscode2session');
  url.searchParams.set('appid', appId);
  url.searchParams.set('secret', secret);
  url.searchParams.set('js_code', code);
  url.searchParams.set('grant_type', 'authorization_code');

  let res: Response;
  try {
    res = await fetchWechat(url);
  } catch {
    throw new SilentLoginError('微信服务连接失败，请稍后再试', 502);
  }

  const data = await readWechatJson(res);
  if (!res.ok || data.errcode || !data.openid) {
    console.warn('[mini/silent-login] jscode2session error', { errcode: data.errcode, errmsg: data.errmsg });
    throw new SilentLoginError(wechatErrorMessage(data), Number(data.errcode) === 45009 ? 429 : 400);
  }
  return {
    openid: cleanText(data.openid),
    unionid: cleanText(data.unionid),
    sessionKey: cleanText(data.session_key),
  };
}

function wechatName(openid: string) {
  return `微信学员${openid.slice(-6).toUpperCase()}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const session = await getWechatSession(cleanText(body.code));
    const { appId } = getWechatConfig();
    const identity = {
      appId,
      channel: 'mini_program' as const,
      openid: session.openid,
      unionid: session.unionid,
      metadata: { loginMethod: 'wx.login' },
    };

    return withDb((db) => {
      let member = resolveWechatMember(db, identity).member;

      if (!member) {
        const result = db.prepare(
          `INSERT INTO Member (
             name, phone, source, status, register_date, created_at
           )
           VALUES (?, NULL, 'wechat_silent', 'active', date('now','localtime'), datetime('now','localtime'))`
        ).run(wechatName(session.openid));
        member = db.prepare('SELECT * FROM Member WHERE id=?').get<any>(result.lastInsertRowid);
        createWelcomeMessage(db, Number(member.id), cleanText(member.name));
      }

      member = canonicalMember(db, bindWechatIdentity(db, member.id, identity)) || member;
      return Response.json({
        success: true,
        data: loginData(member),
      });
    });
  } catch (err: any) {
    if (err instanceof SilentLoginError) return jsonError(err.message, err.status);
    return jsonError(err.message);
  }
}
