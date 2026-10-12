import { getMemberId, jsonError } from '../../_helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const SHOP_ORIGIN = process.env.SHOP_API_ORIGIN || 'https://www.swod.com.cn';
type Context = { params: Promise<{ path: string[] }> };

async function forward(request: Request, context: Context) {
  const path = (await context.params).path;
  const publicRead = request.method === 'GET' && (path.join('/') === 'products' || path[0] === 'images' || (path[0] === 'courses' && path.length === 3 && ['online','offline'].includes(path[1])));
  const allowed = publicRead || (request.method==='GET' && path[0]==='courses' && path.length===3 && path[1]==='event') || path.join('/') === 'shipping' ||
    (path[0] === 'orders' && path.length <= 3 && (!path[2] || ['pay','refresh','cancel','received','refund'].includes(path[2])));
  if (!allowed) return jsonError('接口不存在', 404);
  if (!publicRead && !getMemberId(new URL(request.url).searchParams, request)) return jsonError('请先登录', 401);
  const headers = new Headers({ 'content-type': 'application/json', 'origin': 'https://www.swod.com.cn', 'x-client-platform': 'miniprogram' });
  const token = request.headers.get('authorization');
  if (token) headers.set('authorization', token);
  try {
    const response = await fetch(`${SHOP_ORIGIN}/api/shop/${path.map(encodeURIComponent).join('/')}`, {
      method: request.method, headers, cache: 'no-store', redirect: 'manual',
      ...(request.method !== 'GET' ? { body: await request.text() } : {}),
      signal: AbortSignal.timeout(25000),
    });
    const resultHeaders = new Headers({ 'Cache-Control': 'private, no-store' });
    for (const name of ['content-type', 'location']) {
      const value = response.headers.get(name); if (value) resultHeaders.set(name, value);
    }
    return new Response(response.body, { status: response.status, headers: resultHeaders });
  } catch { return jsonError('商城连接暂时不可用，请稍后重试', 503); }
}
export const GET = forward;
export const POST = forward;
export const PUT = forward;
