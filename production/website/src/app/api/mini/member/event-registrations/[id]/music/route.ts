import { NextRequest } from 'next/server';
import { getAuthenticatedMemberId } from '../../../../_helpers';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
async function forward(request: NextRequest, id: string) {
  if (!getAuthenticatedMemberId(request)) return Response.json({ success: false, error: '请先登录' }, { status: 401 });
  if (!/^\d+$/.test(id)) return Response.json({ success: false, error: '报名记录不存在' }, { status: 404 });
  const size = Number(request.headers.get('content-length') || 0);
  if (size > 10 * 1024 * 1024 + 65536) return Response.json({ success: false, error: '音乐文件不能超过10MB' }, { status: 413 });
  try {
    const base = (process.env.MANAGEMENT_API_BASE || 'https://admin.swod.com.cn/api').replace(/\/$/, '');
    const options: RequestInit & { duplex?: 'half' } = {
      method: request.method,
      headers: { Authorization: request.headers.get('authorization') || '', 'Content-Type': request.headers.get('content-type') || 'application/json' },
      body: request.method === 'POST' ? request.body : undefined,
      duplex: 'half',
      cache: 'no-store', signal: AbortSignal.timeout(120000),
    };
    const response = await fetch(`${base}/mini/member/event-registrations/${id}/music`, options);
    return new Response(await response.text(), { status: response.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', Vary: 'Authorization, Cookie' } });
  } catch { return Response.json({ success: false, error: '音乐上传连接中断，请重新查看当前音乐后重试' }, { status: 502 }); }
}
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { return forward(request, (await params).id); }
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { return forward(request, (await params).id); }
