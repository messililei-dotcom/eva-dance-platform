'use client';

import { useEffect } from 'react';
import { clearStudentSession, getStudentSession, preferredStudentName, saveStudentSession } from '@/lib/student-auth';
import { parseMemberTokenMemberId } from '@/lib/student-session-client';

export default function StudentSessionBootstrap() {
  useEffect(() => {
    let active = true;
    let refreshing = false;

    const refreshSession = () => {
      if (refreshing || !navigator.onLine) return;
      refreshing = true;
      const current = getStudentSession();
      const headers = new Headers();
      if (current?.token) headers.set('Authorization', `Bearer ${current.token}`);

      fetch('/api/mini/session/refresh', {
        method: 'POST',
        headers,
        credentials: 'same-origin',
        cache: 'no-store',
      })
        .then(async (response) => {
          if (response.status === 401) {
            if (active && current) clearStudentSession();
            return null;
          }
          if (!response.ok) return null;
          return response.json();
        })
        .then((payload) => {
          if (!active || !payload?.success || !payload?.data?.token || !payload?.data?.member?.id) return;
          const tokenId = parseMemberTokenMemberId(String(payload.data.token));
          const memberId = String(payload.data.member.id);
          if (tokenId && tokenId !== memberId) {
            clearStudentSession();
            return;
          }
          try {
            window.localStorage.setItem('student_member', JSON.stringify(payload.data.member));
            if (payload.data.expiresAt) {
              window.localStorage.setItem('student_auth_expires_at', String(payload.data.expiresAt));
            }
          } catch {}
          saveStudentSession({
            token: String(payload.data.token),
            id: memberId,
            name: preferredStudentName(payload.data.member),
            expiresAt: Number(payload.data.expiresAt || 0),
          });
        })
        .catch(() => {
          // Network failures must stay invisible to the learner. The current
          // valid session remains usable and will be refreshed after reconnect.
        })
        .finally(() => { refreshing = false; });
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refreshSession();
    };
    refreshSession();
    window.addEventListener('online', refreshSession);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      active = false;
      window.removeEventListener('online', refreshSession);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, []);

  return null;
}
