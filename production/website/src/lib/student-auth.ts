'use client';

import {
  parseMemberTokenExpiry,
  parseMemberTokenMemberId,
  STUDENT_SESSION_TTL_MS,
} from '@/lib/student-session-client';

const STUDENT_TOKEN_KEY = 'student_token';
const STUDENT_MEMBER_KEY = 'student_member';
const STUDENT_AUTH_EXPIRES_KEY = 'student_auth_expires_at';
const LEGACY_STUDENT_TOKEN_KEY = 'studentToken';
const LEGACY_STUDENT_ID_KEY = 'studentId';
const LEGACY_STUDENT_NAME_KEY = 'studentName';
const LEGACY_STUDENT_AUTH_EXPIRES_KEY = 'studentAuthExpiresAt';
export const STUDENT_AUTH_CHANGED_EVENT = 'student-auth-changed';
const STUDENT_AUTH_TTL_MS = STUDENT_SESSION_TTL_MS;

type StudentSessionInput = {
  token: string;
  id: string | number;
  name?: string;
  expiresAt?: number;
};

export type StudentSession = {
  token: string;
  id: string;
  name: string;
};

export function preferredStudentName(source: unknown, fallback = ''): string {
  if (!source || typeof source !== 'object') return fallback;
  const member = source as Record<string, unknown>;
  const keys = [
    'wxName',
    'wx_name',
    'wxNickname',
    'wx_nickname',
    'nickname',
    'name',
    'realName',
    'real_name',
    'username',
  ];
  for (const key of keys) {
    const value = member[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return fallback;
}

function notifyStudentAuthChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(STUDENT_AUTH_CHANGED_EVENT));
}

function removeStudentSession({ notify = true } = {}) {
  if (typeof window === 'undefined') return;
  const hadSession = [
    STUDENT_TOKEN_KEY,
    STUDENT_MEMBER_KEY,
    STUDENT_AUTH_EXPIRES_KEY,
    LEGACY_STUDENT_TOKEN_KEY,
    LEGACY_STUDENT_ID_KEY,
    LEGACY_STUDENT_NAME_KEY,
    LEGACY_STUDENT_AUTH_EXPIRES_KEY,
  ].some((key) => window.localStorage.getItem(key) !== null);

  window.localStorage.removeItem(STUDENT_TOKEN_KEY);
  window.localStorage.removeItem(STUDENT_MEMBER_KEY);
  window.localStorage.removeItem(STUDENT_AUTH_EXPIRES_KEY);
  window.localStorage.removeItem(LEGACY_STUDENT_TOKEN_KEY);
  window.localStorage.removeItem(LEGACY_STUDENT_ID_KEY);
  window.localStorage.removeItem(LEGACY_STUDENT_NAME_KEY);
  window.localStorage.removeItem(LEGACY_STUDENT_AUTH_EXPIRES_KEY);

  if (notify && hadSession) notifyStudentAuthChanged();
}

function nextExpiry(token: string, requestedExpiry?: number): number {
  const tokenExp = parseMemberTokenExpiry(token);
  const localExp = Date.now() + STUDENT_AUTH_TTL_MS;
  const candidates = [tokenExp, localExp, Number(requestedExpiry || 0)].filter(value => value > 0);
  return Math.min(...candidates);
}

function readStoredMember(): { id: string; name: string } | null {
  try {
    const raw = window.localStorage.getItem(STUDENT_MEMBER_KEY);
    if (!raw) return null;
    const member = JSON.parse(raw) as Record<string, unknown>;
    const id = String(member.id || member.memberId || member.member_id || member.studentId || member.student_id || '');
    const name = preferredStudentName(member);
    return id ? { id, name } : null;
  } catch {
    return null;
  }
}

function writeStoredMember(session: StudentSessionInput) {
  let member: Record<string, unknown> = {};
  try {
    const raw = window.localStorage.getItem(STUDENT_MEMBER_KEY);
    member = raw ? JSON.parse(raw) as Record<string, unknown> : {};
  } catch {
    member = {};
  }

  const requestedId = String(session.id || '');
  const tokenId = parseMemberTokenMemberId(session.token);
  const nextId = tokenId || requestedId;
  const currentId = String(member.id || member.memberId || member.member_id || member.studentId || member.student_id || '');
  const sameMember = Boolean(currentId && nextId && currentId === nextId);
  const nextName = tokenId && requestedId && tokenId !== requestedId
    ? ''
    : session.name || (sameMember ? preferredStudentName(member) : '');

  window.localStorage.setItem(STUDENT_MEMBER_KEY, JSON.stringify({
    ...(sameMember ? member : {}),
    id: nextId,
    name: nextName,
  }));
}

function removeLegacyStudentSession() {
  window.localStorage.removeItem(LEGACY_STUDENT_TOKEN_KEY);
  window.localStorage.removeItem(LEGACY_STUDENT_ID_KEY);
  window.localStorage.removeItem(LEGACY_STUDENT_NAME_KEY);
  window.localStorage.removeItem(LEGACY_STUDENT_AUTH_EXPIRES_KEY);
}

export function saveStudentSession(session: StudentSessionInput) {
  if (typeof window === 'undefined') return;
  const tokenId = parseMemberTokenMemberId(session.token);
  const sessionId = String(session.id || '');
  const id = tokenId || sessionId;
  window.localStorage.setItem(STUDENT_TOKEN_KEY, session.token);
  writeStoredMember({
    ...session,
    id,
    name: tokenId && sessionId && tokenId !== sessionId ? '' : session.name,
  });
  window.localStorage.setItem(STUDENT_AUTH_EXPIRES_KEY, String(nextExpiry(session.token, session.expiresAt)));
  removeLegacyStudentSession();
  notifyStudentAuthChanged();
}

export function clearStudentSession() {
  if (typeof window !== 'undefined') {
    const token = window.localStorage.getItem(STUDENT_TOKEN_KEY) || '';
    void fetch('/api/mini/session/logout', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      credentials: 'same-origin',
      keepalive: true,
    }).catch(() => {});
  }
  removeStudentSession();
}

export function getStudentSession(): StudentSession | null {
  if (typeof window === 'undefined') return null;
  const token = window.localStorage.getItem(STUDENT_TOKEN_KEY) || '';
  const member = readStoredMember();
  const tokenId = parseMemberTokenMemberId(token);
  const id = tokenId || member?.id || '';
  const memberMatchesToken = !tokenId || member?.id === tokenId;
  const name = memberMatchesToken ? member?.name || '' : '';
  if (!token || !id) {
    return null;
  }

  let expiresAt = Number(window.localStorage.getItem(STUDENT_AUTH_EXPIRES_KEY) || 0);
  if (!expiresAt) {
    expiresAt = nextExpiry(token);
    window.localStorage.setItem(STUDENT_AUTH_EXPIRES_KEY, String(expiresAt));
  }
  if (expiresAt <= Date.now()) {
    removeStudentSession();
    return null;
  }

  if (!memberMatchesToken) {
    writeStoredMember({ token, id, name: '' });
  }
  removeLegacyStudentSession();
  return { token, id, name };
}

export function updateStudentSessionName(name: string) {
  if (typeof window === 'undefined') return;
  const member = readStoredMember();
  if (!member) return;
  writeStoredMember({ token: window.localStorage.getItem(STUDENT_TOKEN_KEY) || '', id: member.id, name });
  removeLegacyStudentSession();
  notifyStudentAuthChanged();
}

export function updateStudentSessionId(id: string | number) {
  if (typeof window === 'undefined') return;
  const member = readStoredMember();
  if (!member) return;
  writeStoredMember({ token: window.localStorage.getItem(STUDENT_TOKEN_KEY) || '', id, name: member.name });
  removeLegacyStudentSession();
  notifyStudentAuthChanged();
}
