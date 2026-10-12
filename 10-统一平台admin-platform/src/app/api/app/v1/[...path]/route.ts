import { normalizedMusicForm, MusicUploadError } from '@/lib/server/event-music-upload';
import { appPlatform, appMemberSource, appDeviceName } from '@/lib/server/app-platform';
import { appShopPayment } from '@/lib/server/app-shop';
import { carrierLoginEnabled, getCarrierPhone } from '@/lib/server/app-carrier-auth';
import { withDb, memberToken } from '../../../mini/_helpers';
import { upsertPhoneMember } from '../../../mini/_auth';
import { AppError, reserveCarrierAttempt, ensureAppSchema, createAppSession, authenticateApp, rotateAppSession, revokeAppSession, verifyAppSMS, requestAccountDeletion, saveAppCheckpoint } from '@/lib/server/app-session';
import { findAppRoute } from '@/lib/server/app-route-map';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
type Context = { params: Promise<{ path: string[] }> };
const json = (data: unknown, status = 200) => Response.json({ success: true, data }, { status, headers: { 'Cache-Control': 'private, no-store' } });
const bearer = (r: Request) => r.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1] || '';
async function readBody(request: Request) {
  if (['GET', 'HEAD'].includes(request.method)) return {};
  const reader = request.body?.getReader();
  if (!reader) return {};
  let total = 0; const chunks: Uint8Array[] = [];
  while (true) {
    const {done, value} = await reader.read(); if (done) break;
    total += value.byteLength;
    if (total > 32_768) { await reader.cancel(); throw new AppError('提交内容过长', 413); }
    chunks.push(value);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw new AppError('提交格式不正确'); }
}
async function handle(request: Request, context: Context) {
  try {
    const parts = (await context.params).path;
    if (parts.some(p => !p || p.includes('/') || p === '..')) throw new AppError('接口不存在', 404);
    const platform = appPlatform(request.headers);
    const path = parts.join('/'), method = request.method;
    const multipart = method === "POST" && /^events\/[1-9]\d*\/register$/.test(path) && request.headers.get("content-type")?.startsWith("multipart/form-data;");
    const body = multipart ? {} : await readBody(request);
    if (path === 'config' && method === 'GET') return json({
      version: 1, oneTapLogin: carrierLoginEnabled(), offlineDownload: false, digitalPurchase: false, physicalCheckout: Object.values(appShopPayment()).some(Boolean),
      privacyURL: 'https://www.swod.com.cn/privacy', termsURL: 'https://www.swod.com.cn/terms',
      accountDeletion: 'request', minimumVersion: '1.0.0',
    });
    if (path === 'send-code' && method === 'POST') {
      const { POST } = await import('../../../mini/send-code/route');
      return POST(new Request(request.url, { method, headers: request.headers, body: JSON.stringify({phone: body.phone}) }));
    }
    if (path === 'auth/login' && method === 'POST') {
      return withDb(db => {
        ensureAppSchema(db);
        // Invalid attempts must persist; do not wrap verification in a rollback-on-error transaction.
        verifyAppSMS(db, String(body.phone || ''), String(body.code || ''));
        return db.transaction(() => {
          const member = upsertPhoneMember(db, String(body.phone), { source: appMemberSource(platform) });
          return json(createAppSession(db, Number(member.id), String(body.deviceName || appDeviceName(platform))));
        })();
      });
    }
    if (path === 'auth/one-tap' && method === 'POST') {
      if (!carrierLoginEnabled()) throw new AppError('本机号码登录暂未开放，请使用短信验证码', 503);
      if (typeof body.accessToken !== 'string' || body.accessToken.length < 16 || body.accessToken.length > 8192 || /\s/.test(body.accessToken)) throw new AppError('号码认证凭据无效');
      withDb(db => {
        ensureAppSchema(db);
        reserveCarrierAttempt(db, body.accessToken, request.headers.get('x-real-ip') || 'unknown');
      });
      const phone = await getCarrierPhone(body.accessToken);
      return withDb(db => {
        ensureAppSchema(db);
        return db.transaction(() => {
          const member = upsertPhoneMember(db, phone, { source: appMemberSource(platform) });
          return json(createAppSession(db, Number(member.id), String(body.deviceName || appDeviceName(platform))));
        })();
      });
    }
    if (path === 'auth/refresh' && method === 'POST') return withDb(db => {
      ensureAppSchema(db); return json(rotateAppSession(db, String(body.refreshToken || '')));
    });
    const route = findAppRoute(path, method);
    const publicRead = route?.public === true || (path === 'shop/products' && method === 'GET');
    const session = publicRead && !bearer(request) ? null : withDb(db => {
      ensureAppSchema(db); return authenticateApp(db, bearer(request));
    });
    if (path === 'auth/logout' && method === 'POST' && session) return withDb(db => {
      revokeAppSession(db, session.member_id, session.id); return json({ loggedOut: true });
    });
    if (path === 'devices' && method === 'GET' && session) return withDb(db => json(db.prepare(
      'SELECT id,device_name,created_at,last_seen FROM AppSession WHERE member_id=? AND revoked_at IS NULL AND refresh_until>? ORDER BY last_seen DESC'
    ).all(session.member_id, Date.now()).map((row: any) => ({...row, current: row.id === session.id}))));
    if (parts[0] === 'devices' && parts.length === 2 && method === 'DELETE' && session) return withDb(db => {
      revokeAppSession(db, session.member_id, parts[1]); return json({ revoked: true });
    });
    if (path === 'account-deletion-requests' && method === 'POST' && session) return withDb(db => {
      if (body.confirmation !== '注销账号') throw new AppError('请确认注销账号');
      verifyAppSMS(db, String(session.member.phone || ''), String(body.code || ''));
      return json(requestAccountDeletion(db, session.member_id), 202);
    });
    // The legacy member token never leaves the server. Session revocation is checked on every request above.
    const headers = new Headers({'Content-Type':'application/json', 'x-client-platform':platform});
    if (session) headers.set('authorization', `Bearer ${memberToken({id:session.member_id,phone:session.member.phone})}`);
    if (parts[0] === 'shop') {
      const shopPath = parts.slice(1).join('/');
      const payment = appShopPayment();
      const checkout = Object.values(payment).some(Boolean);
      const allowed = (method === 'GET' && (shopPath === 'products' || /^courses\/offline\/[1-9][0-9]*$/.test(shopPath) || shopPath === 'shipping' || shopPath === 'orders' || /^orders\/[A-Za-z0-9_-]+$/.test(shopPath)))
        || (method === 'PUT' && shopPath === 'shipping')
        || (checkout && method === 'POST' && (shopPath === 'orders' || /^orders\/[A-Za-z0-9_-]+\/pay$/.test(shopPath)))
        || (method === 'POST' && /^orders\/[A-Za-z0-9_-]+\/(cancel|refresh|received|refund)$/.test(shopPath));
      if (!allowed) throw new AppError('App 支付尚未开放，当前不能下单或支付', 409);
      if (method === 'POST' && shopPath === 'orders' && body.kind === 'online') throw new AppError('App 录播课程购买需使用苹果内购',409);
      if (method === 'POST' && shopPath === 'orders' && !payment[body.provider as 'wechat' | 'alipay']) throw new AppError('该支付方式暂未开放', 409);
      if (method === 'POST' && shopPath.endsWith('/pay')) {
        const existing = await fetch(`https://www.swod.com.cn/api/shop/${shopPath.slice(0,-4)}`, {headers, redirect:'manual', cache:'no-store',signal:AbortSignal.timeout(20_000)});
        const detail = await existing.json();
        if(detail.order?.kind === 'online') throw new AppError('App 录播课程购买需使用苹果内购',409);
        if (!existing.ok || !payment[detail.order?.provider as 'wechat' | 'alipay']) throw new AppError('订单不存在或支付方式暂未开放',409);
      }
      headers.set('user-agent', 'EvaDance iPhone Mobile');
      headers.set('x-real-ip', request.headers.get('x-real-ip') || '127.0.0.1');
      headers.set('origin', 'https://www.swod.com.cn');
      const result = await fetch(`https://www.swod.com.cn/api/shop/${shopPath}`, {
        method, headers, redirect:'manual', cache:'no-store', signal:AbortSignal.timeout(20_000),
        ...(method !== 'GET' ? {body:JSON.stringify(body)} : {}),
      });
      const payload = await result.json();
      if (!result.ok || payload.error || payload.success === false) throw new AppError(payload.error || payload.message || '商城请求失败', result.ok ? 400 : result.status);
      if (shopPath === 'products' || shopPath.startsWith('courses/')) {
        payload.payment = {...payment,ios:checkout};
        payload.products = (payload.products || []).map((p: any) => ({...p,image: p.image?.startsWith('/') ? `https://www.swod.com.cn${p.image}` : p.image}));
      }
      return json(payload);
    }
    if (!route) throw new AppError('接口不存在', 404);
    // Whitelist writes; do not allow user-supplied identity, attribution or administrative fields.
    delete body.member_id; delete body.memberId;
    if (['notes','bookmarks'].includes(path) && method === 'POST') {
      if (!Number.isSafeInteger(body.video_id) || body.video_id <= 0 || !Number.isFinite(body.timestamp_seconds) || body.timestamp_seconds < 0) throw new AppError('课节或时间位置无效');
      if (String(body.content || body.label || '').length > 5000) throw new AppError('内容不能超过5000字');
    }
    if (/^video\/\d+\/progress$/.test(path) && method === 'POST') {
      if (!Number.isSafeInteger(body.revision) || body.revision < 0 || !Number.isFinite(body.progress) || !Number.isFinite(body.duration) || body.progress < 0 || body.duration <= 0 || body.progress > body.duration || body.duration > 86400) throw new AppError('学习进度无效');
    }
    const url = new URL(request.url); url.pathname = '/api/mini/'+path;
    url.searchParams.delete('member_id'); url.searchParams.delete('memberId');
    if (path === 'member/profile' && method === 'PUT') {
      const module = await import('../../../mini/member/profile/route');
      const old = await (await module.GET(new Request(url, {headers}))).json();
      if (!old.success) throw new AppError('个人资料加载失败');
      const allowed = ['name','gender','birthday','country','province','city','address'];
      const merged = {...old.data.member};
      for (const key of allowed) if (body[key] !== undefined) {
        if (typeof body[key] !== 'string' || body[key].length > 300) throw new AppError('个人资料格式无效');
        merged[key] = body[key];
      }
      Object.keys(body).forEach(key => delete body[key]); Object.assign(body, merged);
    }
    const upload = multipart ? await normalizedMusicForm(request) : undefined;
    if (upload) headers.delete('Content-Type');
    const module = await route.load();
    const handler = (module as any)[method];
    const result: Response = await handler(new Request(url, {method,headers,...(method !== 'GET' ? {body:upload || JSON.stringify(body)} : {})}), {params:Promise.resolve(route.params)});
    if (/^video\/\d+\/progress$/.test(path) && result.ok && session) {
      const lessonId = Number(parts[1]);
      if (method === 'GET') {
        const payload = await result.json();
        return withDb(db => {
          const checkpoint = db.prepare('SELECT position AS progress,duration,revision FROM AppLearningCheckpoint WHERE member_id=? AND lesson_id=?').get(session.member_id,lessonId);
          return json(checkpoint || (payload.data ? {...payload.data,revision:0} : null));
        });
      }
      if (method === 'POST') return withDb(db => json(saveAppCheckpoint(db,session.member_id,lessonId,{progress:body.progress,duration:body.duration,revision:body.revision})));
    }
    if (path === 'member/profile' && result.ok) {
      const payload = await result.json();
      const raw = payload.data || {}; const member = raw.member || raw;
      const safe = Object.fromEntries(['id','name','phone','gender','birthday','country','province','city','address','avatar_url','level'].map(k => [k,member[k]]));
      return json({...safe,stats:raw.stats,growth:raw.growth});
    }
    const responseHeaders = new Headers(result.headers); responseHeaders.set('Cache-Control','private, no-store');
    return new Response(result.body, {status:result.status,headers:responseHeaders});
  } catch (error) {
    const status = error instanceof AppError || error instanceof MusicUploadError ? error.status : 500;
    return Response.json({success:false,message:error instanceof AppError || error instanceof MusicUploadError ? error.message : '服务暂不可用，请稍后重试'}, {status,headers:{'Cache-Control':'private, no-store'}});
  }
}
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
