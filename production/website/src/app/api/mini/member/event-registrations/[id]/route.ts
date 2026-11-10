import { getAuthenticatedMemberId } from '../../../_helpers';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };
async function forward(request: Request, context: Context) {
  if (!getAuthenticatedMemberId(request)) return Response.json({ success: false, error: '请先登录' }, { status: 401 });
  const { id } = await context.params;
  if (!/^\d+$/.test(id)) return Response.json({ success: false, error: '报名记录不存在' }, { status: 404 });
  try {
    const base = (process.env.MANAGEMENT_API_BASE || 'https://admin.swod.com.cn/api').replace(/\/$/, '');
    const response = await fetch(`${base}/mini/member/event-registrations/${id}`, {
      method: request.method,
      headers: { Authorization: request.headers.get('authorization') || '', 'Content-Type': 'application/json' },
      body: request.method === 'PUT' ? JSON.stringify(await request.json()) : undefined,
      cache: 'no-store', signal: AbortSignal.timeout(15000),
    });
    return new Response(await response.text(), { status: response.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', Vary: 'Authorization, Cookie' } });
  } catch { return Response.json({ success: false, error: '报名信息连接失败，请重试' }, { status: 502 }); }
}
export async function GET(request: Request, context: Context) { return forward(request, context); }
export async function PUT(request: Request, context: Context) { return forward(request, context); }
