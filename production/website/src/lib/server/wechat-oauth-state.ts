import crypto from 'crypto';

export type WechatOAuthMode = 'wechat' | 'qr';
export type WechatOAuthPurpose = 'login' | 'bind';

type WechatOAuthState = {
  next: string;
  mode: WechatOAuthMode;
  purpose: WechatOAuthPurpose;
  memberId: number;
  handoffId?: string;
  ts: number;
};

const STATE_TTL_MS = 10 * 60 * 1000;

function cleanText(value: unknown) {
  return String(value ?? '').trim();
}

function normalizeNext(value: unknown) {
  const next = cleanText(value);
  if (!next.startsWith('/') || next.startsWith('//')) return '/';
  return next;
}

function normalizeMode(value: unknown): WechatOAuthMode {
  return cleanText(value) === 'qr' ? 'qr' : 'wechat';
}

function normalizePurpose(value: unknown): WechatOAuthPurpose {
  return cleanText(value) === 'bind' ? 'bind' : 'login';
}

function normalizeHandoffId(value: unknown) {
  const id = cleanText(value);
  return /^[0-9a-f-]{36}$/i.test(id) ? id : '';
}

function stateSecret() {
  return process.env.ADMIN_SESSION_SECRET || 'mini-student-token';
}

function sign(payload: string) {
  return crypto.createHmac('sha256', stateSecret()).update(payload).digest('base64url');
}

export function createWechatOAuthState(input: {
  next: unknown;
  mode: unknown;
  purpose?: unknown;
  memberId?: unknown;
  handoffId?: unknown;
}) {
  const purpose = normalizePurpose(input.purpose);
  const memberId = Number(input.memberId) || 0;
  if (purpose === 'bind' && memberId <= 0) throw new Error('绑定微信需要先登录');
  const handoffId = purpose === 'login' ? normalizeHandoffId(input.handoffId) : '';
  const payload = Buffer.from(JSON.stringify({
    next: normalizeNext(input.next),
    mode: normalizeMode(input.mode),
    purpose,
    memberId: purpose === 'bind' ? memberId : 0,
    ...(handoffId ? { handoffId } : {}),
    ts: Date.now(),
  } satisfies WechatOAuthState)).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function readWechatOAuthState(value: unknown): WechatOAuthState {
  const [payload = '', signature = ''] = cleanText(value).split('.');
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (!payload || expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    throw new Error('微信授权请求无效，请重新操作');
  }
  const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<WechatOAuthState>;
  const state: WechatOAuthState = {
    next: normalizeNext(parsed.next),
    mode: normalizeMode(parsed.mode),
    purpose: normalizePurpose(parsed.purpose),
    memberId: Number(parsed.memberId) || 0,
    ts: Number(parsed.ts) || 0,
  };
  const handoffId = normalizeHandoffId(parsed.handoffId);
  if (handoffId) state.handoffId = handoffId;
  if (!state.ts || Math.abs(Date.now() - state.ts) > STATE_TTL_MS) {
    throw new Error('微信授权已超时，请重新操作');
  }
  if (state.purpose === 'bind' && state.memberId <= 0) {
    throw new Error('绑定微信需要先登录');
  }
  return state;
}
