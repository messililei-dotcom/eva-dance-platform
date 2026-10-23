import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.STUDENT_API_URL
  || process.env.MANAGEMENT_API_BASE
  || process.env.NEXT_PUBLIC_API_URL
  || 'https://admin.swod.com.cn/api';

type ProxyMiniApiOptions = {
  forwardCredentials?: boolean;
  revalidateSeconds?: number;
};

export async function proxyMiniApi(request: NextRequest, path: string, options: ProxyMiniApiOptions = {}) {
  try {
    const authorization = request.headers.get('authorization');
    const cookie = request.headers.get('cookie');
    const method = request.method;
    const body = ['GET', 'HEAD'].includes(method) ? undefined : await request.text();

    const forwardCredentials = options.forwardCredentials !== false;
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(forwardCredentials && authorization ? { Authorization: authorization } : {}),
        ...(forwardCredentials && cookie ? { Cookie: cookie } : {}),
      },
      body: body || undefined,
      ...(options.revalidateSeconds
        ? { next: { revalidate: options.revalidateSeconds } }
        : { cache: 'no-store' as const }),
      signal: AbortSignal.timeout(12000),
    });

    const contentType = response.headers.get('content-type') || 'application/json';
    const payload = await response.text();

    return new NextResponse(payload || '{}', {
      status: response.status,
      headers: { 'Content-Type': contentType, 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Authorization, Cookie' },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || '无法连接统一学习接口' },
      { status: 502 },
    );
  }
}
