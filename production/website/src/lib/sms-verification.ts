export const SMS_SEND_COOLDOWN_MS = 60_000;

type ConnectionLikeError = Error & {
  failure?: {
    logs?: Array<{ responsePreview?: string }>;
  };
};

export class SmsSendGuard {
  private inFlight = false;
  private cooldownUntil = 0;

  tryStart(now = Date.now()) {
    if (this.inFlight || this.remainingSeconds(now) > 0) return false;
    this.inFlight = true;
    return true;
  }

  succeed(now = Date.now()) {
    this.cooldown(60, now);
  }

  cooldown(seconds: number, now = Date.now()) {
    this.inFlight = false;
    this.cooldownUntil = now + Math.max(0, seconds) * 1000;
  }

  fail() {
    this.inFlight = false;
  }

  remainingSeconds(now = Date.now()) {
    return Math.max(0, Math.ceil((this.cooldownUntil - now) / 1000));
  }
}

export class SmsRateLimiter {
  private readonly lockedUntil = new Map<string, number>();

  acquire(key: string, now = Date.now()) {
    const retryAfter = this.retryAfterSeconds(key, now);
    if (retryAfter > 0) return { allowed: false as const, retryAfter };
    this.lockedUntil.set(key, now + SMS_SEND_COOLDOWN_MS);
    return { allowed: true as const, retryAfter: 0 };
  }

  release(key: string) {
    this.lockedUntil.delete(key);
  }

  retryAfterSeconds(key: string, now = Date.now()) {
    const until = this.lockedUntil.get(key) || 0;
    if (until <= now) {
      this.lockedUntil.delete(key);
      return 0;
    }
    return Math.max(1, Math.ceil((until - now) / 1000));
  }
}

export function isSmsProviderRateLimitCode(code: string) {
  const normalized = String(code || '').toUpperCase();
  return normalized.includes('BUSINESS_LIMIT_CONTROL')
    || normalized.includes('RATE_LIMIT')
    || normalized.includes('TOO_MANY');
}

export function smsSendErrorMessage(error: unknown) {
  const fallback = error instanceof Error ? error.message : '验证码发送失败，请稍后重试';
  const connectionError = error as ConnectionLikeError;
  const previews = connectionError?.failure?.logs || [];

  for (let index = previews.length - 1; index >= 0; index -= 1) {
    const preview = previews[index]?.responsePreview;
    if (!preview) continue;
    try {
      const payload = JSON.parse(preview) as { message?: unknown; code?: unknown };
      if (String(payload.code || '') === 'SMS_RATE_LIMIT') return '操作过于频繁，请稍后重试';
      if (typeof payload.message === 'string' && payload.message.trim()) return payload.message.trim();
    } catch {}
  }

  return fallback;
}

export function smsRetryAfterSeconds(error: unknown) {
  const connectionError = error as ConnectionLikeError;
  const previews = connectionError?.failure?.logs || [];
  for (let index = previews.length - 1; index >= 0; index -= 1) {
    const preview = previews[index]?.responsePreview;
    if (!preview) continue;
    try {
      const payload = JSON.parse(preview) as { retryAfter?: unknown };
      const retryAfter = Number(payload.retryAfter);
      if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.ceil(retryAfter);
    } catch {}
  }
  return 0;
}
