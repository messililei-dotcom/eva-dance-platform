import { NextRequest, NextResponse } from 'next/server';

/**
 * 公开API路由列表 — 这些路由不需要Token验证
 */
const PUBLIC_API_PATHS = [
  '/api/login',
  '/api/mini/phone-login',
  '/api/mini/student-login',
  '/api/mini/send-code',
  '/api/mini/student-login-v2',
  '/api/mini/public/',
  '/api/course/cover-image',
  '/api/course/series/cover/',
  '/api/courses/cover-image',
];

function isPublicApiPath(pathname: string): boolean {
  return PUBLIC_API_PATHS.some(prefix => pathname.startsWith(prefix));
}

function getTokenFromRequest(request: NextRequest): string | null {
  // 1. 检查 Authorization: Bearer header
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match) return match[1].trim();
  }
  // 2. 检查 Cookie 中的 token（admin_media_token 用于 <video>/<img> 等媒体元素）
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map(c => c.trim());
    for (const name of ['token', 'admin_media_token']) {
      const raw = cookies.find(c => c.startsWith(`${name}=`))?.slice(name.length + 1);
      if (!raw) continue;
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    }
  }
  return null;
}

function decodeBase64UrlJson(value: string): Record<string, unknown> | null {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + (4 - normalized.length % 4) % 4, '=');
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function tokenStateFromPayload(payload: Record<string, unknown> | null): 'ok' | 'expired' | 'invalid' {
  if (!payload) return 'invalid';
  const exp = Number(payload.exp || 0);
  if (exp && Date.now() > exp) return 'expired';
  return 'ok';
}

function validateLocalTokenShape(token: string): 'ok' | 'expired' | 'invalid' {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'local') return 'invalid';
  const payload = decodeBase64UrlJson(parts[1]);
  if (!payload?.username) return 'invalid';
  return tokenStateFromPayload(payload);
}

function validateMiniMemberTokenShape(token: string): 'ok' | 'expired' | 'invalid' {
  const parts = token.split('.');
  if (parts.length !== 2) return 'invalid';
  const payload = decodeBase64UrlJson(parts[0]);
  if (!payload?.memberId && !payload?.member_id && !payload?.id) return 'invalid';
  return tokenStateFromPayload(payload);
}

function validateTokenForPath(pathname: string, token: string): 'ok' | 'expired' | 'invalid' {
  const localState = validateLocalTokenShape(token);
  if (localState !== 'invalid') return localState;
  if (pathname.startsWith('/api/mini/')) return validateMiniMemberTokenShape(token);
  return 'invalid';
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get('host')?.split(':')[0]?.toLowerCase() || '';

  if (host === 'api.dongfangwuquan.com' && pathname === '/') {
    return NextResponse.redirect('https://www.dongfangwuquan.com/', 308);
  }

  const withRobotsHeader = (response: NextResponse) => {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    return response;
  };

  if (!pathname.startsWith('/api')) {
    return withRobotsHeader(NextResponse.next());
  }

  // 公开端点放行
  if (isPublicApiPath(pathname)) {
    return withRobotsHeader(NextResponse.next());
  }

  // 检查是否存在有效的token（header或cookie）
  const token = getTokenFromRequest(request);
  if (!token) {
    return withRobotsHeader(NextResponse.json(
      { success: false, message: '未登录，请先登录', error: '未登录' },
      { status: 401 }
    ));
  }

  // 基本 token 格式校验（Edge 运行时不做 HMAC，完整签名校验在 route handler 中完成）
  const tokenState = validateTokenForPath(pathname, token);
  if (tokenState === 'expired') {
    return withRobotsHeader(NextResponse.json(
      { success: false, message: '登录已过期，请重新登录', error: 'token_expired' },
      { status: 401 }
    ));
  }
  if (tokenState !== 'ok') {
    return withRobotsHeader(NextResponse.json(
      { success: false, message: '无效的登录凭证', error: 'token_invalid' },
      { status: 401 }
    ));
  }

  return withRobotsHeader(NextResponse.next());
}

export const config = {
  matcher: '/:path*',
};
