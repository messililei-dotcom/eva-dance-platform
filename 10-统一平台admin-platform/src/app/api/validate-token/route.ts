import { findLocalUser, isLocalAuthEnabled, verifyLocalToken } from '../_local-auth';

export const dynamic = 'force-dynamic';

const backendBase = process.env.ADMIN_PLATFORM_BACKEND_URL || 'http://127.0.0.1:3000/api';

function cookieValue(cookieHeader: string | null, names: string[]) {
  if (!cookieHeader) return '';
  const cookies = cookieHeader.split(';').map(cookie => cookie.trim());
  for (const name of names) {
    const prefix = `${name}=`;
    const raw = cookies.find(cookie => cookie.startsWith(prefix))?.slice(prefix.length);
    if (!raw) continue;
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return '';
}

export async function POST(request: Request) {
  const headerAuthorization = request.headers.get('authorization') || '';
  const cookieToken = cookieValue(request.headers.get('cookie'), ['token', 'admin_media_token']);
  const authorization = headerAuthorization || (cookieToken ? `Bearer ${cookieToken}` : '');
  if (!authorization) return Response.json({ error: '未登录' }, { status: 401 });
  const token = authorization.replace(/^Bearer\s+/i, '');
  const localSession = verifyLocalToken(token);
  if (isLocalAuthEnabled() && localSession) {
    const user = findLocalUser(localSession.username);
    if (user && user.status === 'active') {
      return Response.json({
        user: {
          id: user.id,
          username: user.username,
          name: user.name || user.username,
          role: user.role,
        },
      });
    }
  }

  try {
    const backendRes = await fetch(`${backendBase}/validate-token`, {
      method: 'POST',
      headers: { authorization },
      cache: 'no-store',
    });
    const payload = await backendRes.json().catch(() => ({}));
    return Response.json(payload, { status: backendRes.status });
  } catch (err: any) {
    return Response.json({ error: `登录状态验证失败: ${err?.message || '未知错误'}` }, { status: 502 });
  }
}
