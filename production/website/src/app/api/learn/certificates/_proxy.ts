import { NextRequest } from 'next/server';

const API_BASE = (process.env.INTERNAL_STUDENT_API_URL || process.env.STUDENT_API_URL || `${process.env.ADMIN_ORIGIN || 'https://admin.swod.com.cn'}/api`).replace(/\/$/, '');
export async function proxyCertificate(request: NextRequest, id: string, action: 'name' | 'preview') {
  const authorization = request.headers.get('authorization') || '';
  if (!/^Bearer\s+\S+$/i.test(authorization)) return Response.json({ success: false, error: '请先登录学员账号' }, { status: 401 });
  if (!/^[1-9]\d*$/.test(id)) return Response.json({ success: false, error: '证书不存在' }, { status: 404 });
  try {
    const response = await fetch(`${API_BASE}/mini/certificates/${id}/${action}`, {
      method: request.method,
      headers: { Authorization: authorization, 'Content-Type': 'application/json' },
      body: request.method === 'PUT' ? await request.text() : undefined,
      cache: 'no-store', signal: AbortSignal.timeout(30000),
    });
    return new Response(await response.arrayBuffer(), { status: response.status, headers: {
      'Content-Type': response.headers.get('content-type') || 'application/json',
      'Cache-Control': 'no-store, private',
    } });
  } catch {
    return Response.json({ success: false, error: '证书服务暂不可用，请稍后重试' }, { status: 503 });
  }
}
