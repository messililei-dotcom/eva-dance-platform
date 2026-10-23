export const STUDENT_SESSION_TTL_MS = 3 * 86400 * 1000;

function parseMemberTokenPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    const payload = parts.length === 2 ? parts[0] : parts[1] || parts[0];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = `${normalized}${'='.repeat((4 - normalized.length % 4) % 4)}`;
    const body = JSON.parse(globalThis.atob(padded)) as unknown;
    return body && typeof body === 'object' && !Array.isArray(body)
      ? body as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

export function parseMemberTokenMemberId(token: string): string {
  const body = parseMemberTokenPayload(token);
  if (!body) return '';
  for (const key of ['id', 'memberId', 'member_id', 'studentId', 'student_id']) {
    const value = body[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return '';
}

export function parseMemberTokenExpiry(token: string): number {
  try {
    const body = parseMemberTokenPayload(token);
    if (!body) return 0;
    const exp = Number(body.exp);
    if (!Number.isFinite(exp)) return 0;
    return exp < 1_000_000_000_000 ? exp * 1000 : exp;
  } catch {
    return 0;
  }
}
