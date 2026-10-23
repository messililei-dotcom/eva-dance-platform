import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { getAuthenticatedMemberId } from '@/app/api/mini/_helpers';
import { shopDb } from '@/lib/server/shop-service';
import { orderById } from '@/lib/server/shop-core';
import { shopConfig } from '@/lib/server/shop-payments';
import { sealPayState, readPayState, payCookie, PAY_STATE_COOKIE, PAY_IDENTITY_COOKIE } from '@/lib/server/shop-wechat-oauth';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const cookieOptions = {httpOnly:true, secure:true, sameSite:'lax' as const, path:'/'};
export async function GET(request: Request) {
  const url = new URL(request.url), config = shopConfig();
  const memberId = getAuthenticatedMemberId(request);
  let orderId = '';
  const finish = (error: boolean) => {
    const target = new URL('/shop/selection', config.origin);
    if (orderId) target.searchParams.set('order', orderId);
    target.searchParams.set(error ? 'wx_pay_error' : 'wx_pay_resume', '1');
    const response = NextResponse.redirect(target);
    response.cookies.set(PAY_STATE_COOKIE, '', {...cookieOptions,maxAge:0});
    response.headers.set('Cache-Control','private, no-store');
    return response;
  };
  try {
    if (!memberId || !config.wxJsapi || !/micromessenger/i.test(request.headers.get('user-agent') || '')) throw Error('Unavailable');
    const appId = process.env.WECHAT_WEB_APP_ID || process.env.WECHAT_OFFICIAL_APP_ID || process.env.WECHAT_MP_APP_ID;
    const secret = process.env.WECHAT_WEB_APP_SECRET || process.env.WECHAT_OFFICIAL_APP_SECRET || process.env.WECHAT_MP_APP_SECRET;
    if (!appId || !secret || config.wxApp !== appId) throw Error('App mismatch');
    if (url.searchParams.has('state')) {
      const state = readPayState(payCookie(request, PAY_STATE_COOKIE));
      if (!state || state.kind !== 'authorize' || state.memberId !== memberId || state.appId !== appId || state.nonce !== url.searchParams.get('state')) throw Error('Invalid state');
      orderId = state.orderId;
      shopDb(db => orderById(db, orderId, memberId));
      const code = url.searchParams.get('code');
      if (!code || code.length > 512) throw Error('Missing code');
      const endpoint = new URL('https://api.weixin.qq.com/sns/oauth2/access_token');
      for (const [k,v] of Object.entries({appid:appId,secret,code,grant_type:'authorization_code'})) endpoint.searchParams.set(k,v);
      const result = await fetch(endpoint,{cache:'no-store',signal:AbortSignal.timeout(10000)});
      const data = await result.json();
      if (!result.ok || data.errcode || typeof data.openid !== 'string' || !/^[\w-]{10,128}$/.test(data.openid)) throw Error('Exchange failed');
      const response = finish(false);
      response.cookies.set(PAY_IDENTITY_COOKIE,sealPayState({kind:'payer',memberId,appId,openid:data.openid},30*60*1000),{...cookieOptions,maxAge:1800});
      return response;
    }
    orderId = url.searchParams.get('order') || '';
    const order = shopDb(db => orderById(db,orderId,memberId));
    if (order.provider !== 'wechat' || order.status !== 'pending' || order.expires_at <= Date.now()) throw Error('Order not payable');
    const nonce = crypto.randomBytes(24).toString('hex');
    const target = new URL('https://open.weixin.qq.com/connect/oauth2/authorize');
    for (const [k,v] of Object.entries({appid:appId,redirect_uri:config.origin+'/api/shop/wechat/authorize',response_type:'code',scope:'snsapi_base',state:nonce})) target.searchParams.set(k,v);
    target.hash = 'wechat_redirect';
    const response = NextResponse.redirect(target);
    response.cookies.set(PAY_STATE_COOKIE,sealPayState({kind:'authorize',memberId,appId,orderId,nonce},5*60*1000),{...cookieOptions,maxAge:300});
    response.headers.set('Cache-Control','private, no-store');
    return response;
  } catch {
    return finish(true);
  }
}
