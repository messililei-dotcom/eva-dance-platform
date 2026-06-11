import crypto from 'crypto';
import { toPositiveInt } from '../_helpers';

type StreamTokenPayload = {
  videoId: number;
  memberId: number;
  exp: number;
};

function streamSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error('ADMIN_SESSION_SECRET 环境变量未配置');
  return secret;
}

function sign(payload: string) {
  return crypto.createHmac('sha256', streamSecret()).update(payload).digest('base64url');
}

export function createVideoStreamToken(videoId: unknown, memberId: unknown, ttlMs = 10 * 60 * 1000) {
  const payload = Buffer.from(JSON.stringify({
    videoId: toPositiveInt(videoId),
    memberId: toPositiveInt(memberId),
    exp: Date.now() + ttlMs,
  })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifyVideoStreamToken(token: string): StreamTokenPayload | null {
  const [payload, signature] = String(token || '').split('.');
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const videoId = toPositiveInt(data.videoId);
    const memberId = toPositiveInt(data.memberId);
    const exp = Number(data.exp || 0);
    if (!videoId || !memberId || !Number.isFinite(exp) || exp < Date.now()) return null;
    return { videoId, memberId, exp };
  } catch {
    return null;
  }
}
