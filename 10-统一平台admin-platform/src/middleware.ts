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
  '/api/course/cover-image',
  '/api/courses/cover-image',
  '/api/certificates/verify',
  '/api/inbox/jobs/run',
];

const PUBLIC_API_PREFIXES = [
  '/api/mini/public/',
  '/api/course/series/cover/',
];

function isPublicApiPath(pathname: string): boolean {
  return PUBLIC_API_PATHS.includes(pathname)
    || PUBLIC_API_PREFIXES.some(prefix => pathname.startsWith(prefix));
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

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function bytesToBase64Url(bytes: ArrayBuffer) {
  let binary = '';
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function hasValidHmac(payload: string, signature: string) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || !payload || !signature) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const expected = bytesToBase64Url(await crypto.subtle.sign('HMAC', key, encoder.encode(payload)));
  return constantTimeEqual(expected, signature);
}

async function validateLocalToken(token: string): Promise<'ok' | 'expired' | 'invalid'> {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'local') return 'invalid';
  const [, encodedPayload, signature] = parts;
  if (!await hasValidHmac(encodedPayload, signature)) return 'invalid';
  const payload = decodeBase64UrlJson(encodedPayload);
  if (!payload?.username) return 'invalid';
  return tokenStateFromPayload(payload);
}

async function validateMiniMemberToken(token: string): Promise<'ok' | 'expired' | 'invalid'> {
  const parts = token.split('.');
  if (parts.length !== 2) return 'invalid';
  const [encodedPayload, signature] = parts;
  if (!await hasValidHmac(encodedPayload, signature)) return 'invalid';
  const payload = decodeBase64UrlJson(encodedPayload);
  if (!payload?.memberId && !payload?.member_id && !payload?.id) return 'invalid';
  return tokenStateFromPayload(payload);
}

async function validateTokenForPath(pathname: string, token: string): Promise<'ok' | 'expired' | 'invalid'> {
  const localState = await validateLocalToken(token);
  if (localState !== 'invalid') return localState;
  if (pathname.startsWith('/api/mini/')) return validateMiniMemberToken(token);
  return 'invalid';
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get('host')?.split(':')[0]?.toLowerCase() || '';

  if (host === 'api.swod.com.cn' && pathname === '/') {
    return NextResponse.redirect('https://www.swod.com.cn/', 308);
  }

  const withRobotsHeader = (response: NextResponse) => {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    const isPublicCover = pathname === '/api/course/cover-image'
      || pathname === '/api/courses/cover-image'
      || pathname.startsWith('/api/course/series/cover/');
    if (isPublicCover) {
      response.headers.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
      response.headers.delete('Pragma');
      response.headers.delete('Expires');
      response.headers.delete('Vary');
    } else if (pathname.startsWith('/api')) {
      response.headers.set('Cache-Control', 'private, no-store, no-cache, max-age=0, s-maxage=0');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
      response.headers.set('Vary', 'Authorization, Cookie');
    } else if (
      !pathname.startsWith('/_next/')
      && !pathname.startsWith('/uploads/')
      && !/\.[a-z0-9]{2,8}$/i.test(pathname)
    ) {
      response.headers.set('Cache-Control', 'private, no-store, no-cache, max-age=0, s-maxage=0');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
    }
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

  // 所有受保护接口必须在统一入口验证 HMAC，route handler 的二次校验作为纵深防御。
  const tokenState = await validateTokenForPath(pathname, token);
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
