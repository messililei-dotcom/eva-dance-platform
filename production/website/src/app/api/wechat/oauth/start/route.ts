import { NextResponse } from 'next/server';
import { getAuthenticatedMemberId, withDb } from '@/app/api/mini/_helpers';
import { createWechatLoginHandoff } from '@/lib/server/wechat-login-handoff';
import { createWechatOAuthState, type WechatOAuthPurpose } from '@/lib/server/wechat-oauth-state';

function cleanText(value: unknown) {
  return String(value ?? '').trim();
}

type WechatLoginMode = 'wechat' | 'qr';

function normalizeMode(value: string): WechatLoginMode {
  return value === 'qr' ? 'qr' : 'wechat';
}

function getWechatWebConfig(mode: WechatLoginMode) {
  if (mode === 'qr') {
    const appId = cleanText(process.env.WECHAT_QR_APP_ID || process.env.WECHAT_OPEN_APP_ID);
    const secret = cleanText(process.env.WECHAT_QR_APP_SECRET || process.env.WECHAT_OPEN_APP_SECRET);
    return { appId, configured: !!(appId && secret) };
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
  return { appId, configured: !!(appId && secret) };
}

function getSiteOrigin(request: Request) {
  const configured = cleanText(process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL).replace(/\/$/, '');
  const url = new URL(request.url);
  if (configured && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(configured)) return configured;
  return `${url.protocol}//${url.host}`;
}

function getQrRedirectOrigin(siteOrigin: string) {
  const configured = cleanText(process.env.WECHAT_QR_REDIRECT_ORIGIN).replace(/\/$/, '');
  if (configured && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(configured)) return configured;
  return siteOrigin;
}

function normalizeNext(value: string) {
  if (!value || !value.startsWith('/')) return '/';
  if (value.startsWith('//')) return '/';
  return value;
}

function normalizePurpose(value: string): WechatOAuthPurpose {
  return value === 'bind' ? 'bind' : 'login';
}

export async function GET(request: Request) {
  const current = new URL(request.url);
  const next = normalizeNext(current.searchParams.get('next') || '/');
  const mode = normalizeMode(current.searchParams.get('mode') || '');
  const purpose = normalizePurpose(current.searchParams.get('purpose') || '');
  const handoffRequested = current.searchParams.get('handoff') === '1';
  const origin = getSiteOrigin(request);
  const memberId = getAuthenticatedMemberId(request);
  if (purpose === 'bind' && !memberId) {
    const fallback = new URL(next, origin);
    fallback.searchParams.set('wechat_bind_error', '登录状态已失效，请重新登录后绑定微信');
    return NextResponse.redirect(fallback);
  }
  const isWechatClient = /micromessenger/i.test(request.headers.get('user-agent') || '');
  if (mode === 'wechat' && !isWechatClient) {
    const fallback = new URL(next, origin);
    if (purpose === 'bind') {
      fallback.searchParams.set('wechat_bind_error', '请在微信内打开官网后完成绑定');
    } else {
      fallback.searchParams.set('login', '1');
      fallback.searchParams.set('wechat_error', 'open_in_wechat');
    }
    return NextResponse.redirect(fallback);
  }
  const { appId, configured } = getWechatWebConfig(mode);
  if (!configured) {
    const fallback = new URL(next, origin);
    if (purpose === 'bind') {
      fallback.searchParams.set('wechat_bind_error', mode === 'qr'
        ? '微信扫码绑定暂未配置，请在微信内打开官网完成绑定'
        : '微信绑定服务暂不可用，请联系管理员');
    } else {
      fallback.searchParams.set('login', '1');
      fallback.searchParams.set('wechat_error', 'config');
    }
    return NextResponse.redirect(fallback);
  }

  const redirectOrigin = mode === 'qr' ? getQrRedirectOrigin(origin) : origin;
  const redirectUri = `${redirectOrigin}/api/wechat/oauth/callback`;
  const handoff = handoffRequested && mode === 'qr' && purpose === 'login'
    ? withDb((db) => createWechatLoginHandoff(db))
    : null;
  const authorize = new URL(
    mode === 'qr'
      ? 'https://open.weixin.qq.com/connect/qrconnect'
      : 'https://open.weixin.qq.com/connect/oauth2/authorize'
  );
  authorize.searchParams.set('appid', appId);
  authorize.searchParams.set('redirect_uri', redirectUri);
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('scope', mode === 'qr' ? 'snsapi_login' : 'snsapi_userinfo');
  authorize.searchParams.set('state', createWechatOAuthState({
    next,
    mode,
    purpose,
    memberId,
    handoffId: handoff?.id,
  }));
  if (mode === 'qr') authorize.searchParams.set('style', 'black');

  const authorizeUrl = `${authorize.toString()}#wechat_redirect`;
  if (handoff) {
    return Response.json({
      success: true,
      authorizeUrl,
      handoffId: handoff.id,
      pollToken: handoff.pollToken,
      expiresAt: handoff.expiresAt,
    }, { headers: { 'Cache-Control': 'no-store' } });
  }

  return NextResponse.redirect(authorizeUrl);
}
