import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.STUDENT_API_URL
  || process.env.MANAGEMENT_API_BASE
  || process.env.NEXT_PUBLIC_API_URL
  || 'https://admin.swod.com.cn/api';

export async function proxyJson(request: NextRequest, path: string) {
  try {
    const body = await request.json().catch(() => ({}));
    const authorization = request.headers.get('authorization');
    const cookie = request.headers.get('cookie');
    const response = await fetch(`${API_BASE}${path}`, {
      method: request.method,
      headers: {
        'Content-Type': 'application/json',
        ...(authorization ? { Authorization: authorization } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });

    const payload = await response.json().catch(() => ({}));
    return NextResponse.json(payload, { status: response.status });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || '无法连接统一接口' },
      { status: 502 },
    );
  }
}
