import { isLocalAuthEnabled, localLogin } from '../_local-auth';

export const dynamic = 'force-dynamic';

const backendBase = process.env.ADMIN_PLATFORM_BACKEND_URL || 'http://127.0.0.1:3000/api';

// 登录频率限制：基于IP，5次失败后锁定15分钟
const loginRateLimitMap = new Map<string, { count: number; lockUntil: number }>();
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCK_MINUTES = 15;

function checkLoginRateLimit(ip: string): { allowed: boolean; remainingMinutes?: number } {
  const now = Date.now();
  const record = loginRateLimitMap.get(ip);

  if (record) {
    if (now < record.lockUntil) {
      const remainingMinutes = Math.ceil((record.lockUntil - now) / 60000);
      return { allowed: false, remainingMinutes };
    }
    // 锁定已过期，重置计数
    if (now >= record.lockUntil) {
      loginRateLimitMap.delete(ip);
    }
  }

  return { allowed: true };
}

function recordLoginFailure(ip: string) {
  const now = Date.now();
  const record = loginRateLimitMap.get(ip) || { count: 0, lockUntil: 0 };

  // 如果锁定已过期，重置
  if (now >= record.lockUntil) {
    record.count = 0;
    record.lockUntil = 0;
  }

  record.count += 1;

  if (record.count >= LOGIN_MAX_ATTEMPTS) {
    record.lockUntil = now + LOGIN_LOCK_MINUTES * 60 * 1000;
  }

  loginRateLimitMap.set(ip, record);
}

function clientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwardedFor || request.headers.get('x-real-ip') || '127.0.0.1';
}

// 定期清理过期的锁定记录（每5分钟清理一次）
setInterval(() => {
  const now = Date.now();
  Array.from(loginRateLimitMap.entries()).forEach(([ip, record]) => {
    if (now >= record.lockUntil) {
      loginRateLimitMap.delete(ip);
    }
  });
}, 5 * 60 * 1000);

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const username = String(body.username || '').trim();
  const password = String(body.password || '');

  if (!username || !password) {
    return Response.json({ error: '请输入账号和密码' }, { status: 400 });
  }

  // 登录频率限制检查
  const ip = clientIp(request);
  const rateLimit = checkLoginRateLimit(ip);
  if (!rateLimit.allowed) {
    return Response.json(
      { error: `登录尝试过于频繁，请在${rateLimit.remainingMinutes}分钟后再试` },
      { status: 429 }
    );
  }

  // 优先本地登录
  const localPayload = localLogin(username, password);
  if (localPayload) {
    // 登录成功后清除该IP的失败记录
    loginRateLimitMap.delete(ip);
    return Response.json(localPayload, {
      headers: {
        'Set-Cookie': `token=${localPayload.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`,
      },
    });
  }

  // 本地登录失败，记录失败次数
  recordLoginFailure(ip);

  // 尝试后端转发
  try {
    const backendRes = await fetch(`${backendBase}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      cache: 'no-store',
    });
    const payload = await backendRes.json().catch(() => ({}));

    if (!backendRes.ok) {
      recordLoginFailure(ip);
      return Response.json(
        { error: payload.error || payload.message || '登录失败，请检查账号和密码' },
        { status: backendRes.status },
      );
    }
    if (!payload?.token || !payload?.user) {
      recordLoginFailure(ip);
      return Response.json({ error: '登录服务返回异常，请稍后重试' }, { status: 502 });
    }

    // 登录成功后清除该IP的失败记录
    loginRateLimitMap.delete(ip);
    return Response.json(payload);
  } catch {
    recordLoginFailure(ip);
    return Response.json({ error: '账号或密码错误' }, { status: 401 });
  }
}
