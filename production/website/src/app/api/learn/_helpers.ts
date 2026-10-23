import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.STUDENT_API_URL
  || process.env.MANAGEMENT_API_BASE
  || process.env.NEXT_PUBLIC_API_URL
  || 'https://admin.swod.com.cn/api';

type QueryValue = string | null;

function firstQuery(params: URLSearchParams, keys: string[]): QueryValue {
  for (const key of keys) {
    const value = params.get(key);
    if (value) return value;
  }
  return null;
}

async function fetchJson(request: NextRequest, path: string) {
  const authorization = request.headers.get('authorization');
  const cookie = request.headers.get('cookie');
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(authorization ? { Authorization: authorization } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

export async function proxyLearnList(request: NextRequest, paths: string[]) {
  try {
    const params = request.nextUrl.searchParams;
    const memberId = firstQuery(params, ['member_id', 'memberId', 'studentId']);
    if (!memberId) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const normalizedPaths = paths.map(path => {
      const separator = path.includes('?') ? '&' : '?';
      return `${path}${separator}member_id=${encodeURIComponent(memberId)}&memberId=${encodeURIComponent(memberId)}`;
    });

    let lastPayload: unknown = {};
    let lastStatus = 502;
    for (const path of normalizedPaths) {
      const { response, payload } = await fetchJson(request, path);
      lastPayload = payload;
      lastStatus = response.status;
      if (response.ok) return NextResponse.json(payload, { status: response.status });
    }

    return NextResponse.json(lastPayload, { status: lastStatus });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || '无法连接统一接口' },
      { status: 502 },
    );
  }
}
