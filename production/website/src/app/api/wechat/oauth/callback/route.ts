import { removeUnusedAvatars } from '@/lib/server/member-avatar';
import { mergeMemberAccounts, serializeMember } from '@/app/api/mini/_auth';
import {
  attachMemberSessionCookies,
  cleanText,
  createMemberDeviceSession,
  getAuthenticatedMemberId,
  withDb,
} from '@/app/api/mini/_helpers';
import {
  bindWechatIdentity,
  resolveWechatMember,
  WechatIdentityConflictError,
  type WechatIdentityChannel,
} from '@/lib/server/wechat-identity';
import { readWechatOAuthState, type WechatOAuthPurpose } from '@/lib/server/wechat-oauth-state';
import {
  completeWechatLoginHandoff,
  failWechatLoginHandoff,
} from '@/lib/server/wechat-login-handoff';

type WechatOAuthToken = Record<string, any> & {
  access_token?: string;
  openid?: string;
  unionid?: string;
  scope?: string;
  errcode?: number;
  errmsg?: string;
};

type WechatUserInfo = Record<string, any> & {
  openid?: string;
  nickname?: string;
  headimgurl?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
};

class WechatOAuthError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'WechatOAuthError';
    this.status = status;
  }
}

type WechatLoginMode = 'wechat' | 'qr';

function normalizeMode(value: unknown): WechatLoginMode {
  return cleanText(value) === 'qr' ? 'qr' : 'wechat';
}

function getWechatWebConfig(mode: WechatLoginMode) {
  if (mode === 'qr') {
    const appId = cleanText(process.env.WECHAT_QR_APP_ID || process.env.WECHAT_OPEN_APP_ID);
    const secret = cleanText(process.env.WECHAT_QR_APP_SECRET || process.env.WECHAT_OPEN_APP_SECRET);
    if (!appId || !secret) throw new WechatOAuthError('微信扫码登录暂未配置，请在微信中打开官网使用微信一键登录', 503);
    return { appId, secret, channel: 'website' as WechatIdentityChannel };
  }

  const appId = cleanText(
    process.env.WECHAT_WEB_APP_ID
    || process.env.WECHAT_OFFICIAL_APP_ID
    || process.env.WECHAT_MP_APP_ID
    || process.env.NEXT_PUBLIC_WECHAT_APP_ID
  );
  const secret = cleanText(
    process.env.WECHAT_WEB_APP_SECRET
    || process.env.WECHAT_OFFICIAL_APP_SECRET
    || process.env.WECHAT_MP_APP_SECRET
  );
  if (!appId || !secret) throw new WechatOAuthError('微信登录服务暂不可用，请联系管理员', 503);
  return { appId, secret, channel: 'official_account' as WechatIdentityChannel };
}

function getSiteOrigin(request: Request) {
  const configured = cleanText(process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL).replace(/\/$/, '');
  const url = new URL(request.url);
  if (configured && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(configured)) return configured;
  return `${url.protocol}//${url.host}`;
}

function normalizeNext(value: string) {
  if (!value || !value.startsWith('/')) return '/';
  if (value.startsWith('//')) return '/';
  return value;
}

function successNext(value: string, purpose: WechatOAuthPurpose) {
  try {
    const url = new URL(normalizeNext(value), 'https://www.swod.com.cn');
    url.searchParams.delete('login');
    url.searchParams.delete('wechat_error');
    url.searchParams.delete('wechat_bind_error');
    if (purpose === 'bind') url.searchParams.set('wechat_bound', '1');
    return `${url.pathname}${url.search}${url.hash}` || '/';
  } catch {
    return '/';
  }
}

async function readWechatJson<T extends Record<string, any>>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new WechatOAuthError('微信服务响应异常，请稍后再试', 502);
  }
}

function oauthErrorMessage(data: Record<string, any>, fallback: string) {
  switch (Number(data.errcode || 0)) {
    case 40029:
    case 40163:
      return '微信授权已失效，请重新登录';
    case 40125:
    case 40164:
    case 41002:
    case 41004:
      return '微信登录配置异常，请联系管理员';
    case 45009:
      return '微信登录请求过于频繁，请稍后再试';
    default:
      return fallback;
  }
}

async function exchangeCode(code: string, mode: WechatLoginMode) {
  if (!code) throw new WechatOAuthError('缺少微信授权凭证');
  const { appId, secret, channel } = getWechatWebConfig(mode);
  const url = new URL('https://api.weixin.qq.com/sns/oauth2/access_token');
  url.searchParams.set('appid', appId);
  url.searchParams.set('secret', secret);
  url.searchParams.set('code', code);
  url.searchParams.set('grant_type', 'authorization_code');

  const res = await fetch(url, { cache: 'no-store' }).catch(() => null);
  if (!res) throw new WechatOAuthError('微信服务连接失败，请稍后再试', 502);
  const data = await readWechatJson<WechatOAuthToken>(res);
  if (!res.ok || data.errcode || !data.openid || !data.access_token) {
    console.warn('[wechat/oauth] access token error', { errcode: data.errcode, errmsg: data.errmsg });
    throw new WechatOAuthError(oauthErrorMessage(data, '微信授权失败，请稍后再试'), Number(data.errcode) === 45009 ? 429 : 400);
  }
  return { token: data, appId, channel };
}

async function fetchUserInfo(token: WechatOAuthToken) {
  const url = new URL('https://api.weixin.qq.com/sns/userinfo');
  url.searchParams.set('access_token', cleanText(token.access_token));
  url.searchParams.set('openid', cleanText(token.openid));
  url.searchParams.set('lang', 'zh_CN');

  const res = await fetch(url, { cache: 'no-store' }).catch(() => null);
  if (!res) return {} as WechatUserInfo;
  const data = await readWechatJson<WechatUserInfo>(res);
  if (!res.ok || data.errcode) {
    console.warn('[wechat/oauth] userinfo error', { errcode: data.errcode, errmsg: data.errmsg });
    return {} as WechatUserInfo;
  }
  return data;
}

function generatedName(openid: string) {
  return `微信学员${openid.slice(-6).toUpperCase()}`;
}

function loginHtml(payload: { token: string; member: Record<string, any>; next: string }) {
  const token = JSON.stringify(payload.token);
  const member = JSON.stringify(JSON.stringify(payload.member));
  const next = JSON.stringify(payload.next);
  const expiresAt = Date.now() + 3 * 86400 * 1000;
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>微信登录中</title></head><body><script>
try {
  localStorage.setItem('student_token', ${token});
  localStorage.setItem('student_member', ${member});
  localStorage.setItem('student_auth_expires_at', String(${expiresAt}));
  localStorage.removeItem('studentToken');
  localStorage.removeItem('studentId');
  localStorage.removeItem('studentName');
  localStorage.removeItem('studentAuthExpiresAt');
} catch (err) {}
location.replace(${next});
</script><p>微信登录成功，正在返回...</p></body></html>`;
}

function handoffSuccessHtml() {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>微信登录成功</title><style>body{margin:0;background:#f8f3ea;color:#281516;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.card{max-width:420px;margin:18vh auto 0;padding:36px 24px;text-align:center}.icon{display:grid;width:64px;height:64px;margin:0 auto 22px;place-items:center;border-radius:50%;background:#1aad19;color:white;font-size:34px}h1{font-size:24px}p{line-height:1.8;color:#735e50}</style></head><body><main class="card"><div class="icon">✓</div><h1>微信登录成功</h1><p>请返回“伊娃东方舞网课系统App”，课程页面会自动完成登录。</p></main><script>setTimeout(function(){try{window.close()}catch(err){}},800)</script></body></html>`;
}

function errorRedirect(request: Request, next: string, message: string, purpose: WechatOAuthPurpose = 'login') {
  const url = new URL(next, getSiteOrigin(request));
  if (purpose === 'bind') {
    url.searchParams.set('wechat_bind_error', message);
  } else {
    url.searchParams.set('login', '1');
    url.searchParams.set('wechat_error', message);
  }
  return Response.redirect(url, 302);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  let next = '/';
  let mode: WechatLoginMode = 'wechat';
  let purpose: WechatOAuthPurpose = 'login';
  let handoffId = '';
  try {
    const state = readWechatOAuthState(url.searchParams.get('state'));
    next = state.next;
    mode = state.mode;
    purpose = state.purpose;
    handoffId = state.handoffId || '';
    const currentMemberId = getAuthenticatedMemberId(request);
    if (purpose === 'bind' && (!currentMemberId || currentMemberId !== state.memberId)) {
      throw new WechatOAuthError('登录状态已变化，请重新登录后绑定微信', 401);
    }
    const exchange = await exchangeCode(cleanText(url.searchParams.get('code')), mode);
    const token = exchange.token;
    const info = await fetchUserInfo(token);
    const openid = cleanText(token.openid || info.openid);
    const unionid = cleanText(info.unionid || token.unionid);
    const nickname = cleanText(info.nickname);
    const avatar = cleanText(info.headimgurl);

    const identity = {
      appId: exchange.appId,
      channel: exchange.channel,
      openid,
      unionid,
      nickname,
      avatarUrl: avatar,
      metadata: { loginMode: mode },
    };

    const data = withDb((db) => {
      const resolved = resolveWechatMember(db, identity);
      let wechatMember = resolved.member;
      if (purpose !== 'bind' && wechatMember && unionid && resolved.candidateIds.length > 1) {
        for (const duplicateId of resolved.candidateIds) {
          if (duplicateId !== Number(wechatMember.id)) {
            wechatMember = mergeMemberAccounts(db, wechatMember.id, duplicateId) || wechatMember;
          }
        }
      }
      let currentMember = currentMemberId
        ? db.prepare("SELECT * FROM Member WHERE id=? AND status='active'").get<any>(currentMemberId) || null
        : null;
      let member = wechatMember;

      if (purpose === 'bind' && !currentMember) {
        throw new WechatOAuthError('登录状态已失效，请重新登录后绑定微信', 401);
      }
      if (purpose === 'bind' && resolved.candidateIds.some(id => id !== Number(currentMember.id))) {
        throw new WechatIdentityConflictError('该微信已绑定其他会员，请联系客服核对');
      }
      const anotherIdentityForApp = purpose === 'bind'
        ? db.prepare(
          `SELECT id FROM WechatIdentity
           WHERE member_id=? AND app_id=? AND openid<>?
           LIMIT 1`
        ).get(currentMember.id, exchange.appId, openid)
        : null;
      if (anotherIdentityForApp) {
        throw new WechatIdentityConflictError('当前会员已绑定另一微信身份，请联系客服核对');
      }
      if (purpose === 'bind') {
        member = currentMember;
      } else if (currentMember && wechatMember && Number(currentMember.id) !== Number(wechatMember.id)) {
        member = mergeMemberAccounts(db, currentMember.id, wechatMember.id) || currentMember;
        currentMember = member;
      } else if (!member && currentMember) {
        member = currentMember;
      }

      const oldAvatars = [member?.avatar, member?.wx_avatar_url];
      if (!member) {
        const result = db.prepare(
          `INSERT INTO Member (
             name, phone, source, status, register_date, created_at
           )
           VALUES (?, NULL, ?, 'active', date('now','localtime'), datetime('now','localtime'))`
        ).run(
          nickname || generatedName(openid),
          exchange.channel === 'website' ? 'wechat_website' : 'wechat_official',
        );
        member = db.prepare('SELECT * FROM Member WHERE id=?').get<any>(result.lastInsertRowid);
      } else if (nickname || avatar) {
        db.prepare(
          `UPDATE Member
           SET name=CASE WHEN (name LIKE '微信学员%' OR COALESCE(name,'')='') AND ?<>'' THEN ? ELSE name END
           WHERE id=?`
        ).run(nickname, nickname, member.id);
      }

      member = bindWechatIdentity(db, member.id, identity);
      removeUnusedAvatars(db, oldAvatars);
      const session = createMemberDeviceSession(db, member, request, mode === 'qr' ? 'qr' : 'wechat');
      const serializedMember = serializeMember(member);
      if (handoffId && !completeWechatLoginHandoff(db, handoffId, session, serializedMember)) {
        throw new WechatOAuthError('微信授权接力已超时，请返回网课系统App重新登录');
      }
      return { token: session.token, member: serializedMember, session };
    });

    return attachMemberSessionCookies(new Response(handoffId
      ? handoffSuccessHtml()
      : loginHtml({ ...data, next: successNext(next, purpose) }), {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    }), data.session);
  } catch (err: any) {
    const message = err instanceof WechatOAuthError || err instanceof WechatIdentityConflictError
      ? err.message
      : purpose === 'bind' ? '微信绑定失败，请稍后再试' : '微信登录失败，请稍后再试';
    if (handoffId) {
      try {
        withDb((db) => failWechatLoginHandoff(db, handoffId, message));
      } catch {}
    }
    return errorRedirect(request, next, message, purpose);
  }
}
