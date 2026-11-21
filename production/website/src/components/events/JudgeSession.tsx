'use client';

import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { getStudentSession, STUDENT_AUTH_CHANGED_EVENT, type StudentSession } from '@/lib/student-auth';
import { OPEN_STUDENT_LOGIN_EVENT } from '@/lib/ui-events';

function sameSession(a: StudentSession | null | undefined, b: StudentSession | null) {
  return a !== undefined && a?.id === b?.id && a?.token === b?.token;
}

function openJudgeLogin() {
  const { pathname, search } = window.location;
  window.dispatchEvent(new CustomEvent(OPEN_STUDENT_LOGIN_EVENT, {
    detail: { next: pathname + search },
  }));
}

export function isCurrentJudgeSession(session: StudentSession) {
  return sameSession(session, getStudentSession());
}

export default function JudgeSession({ children }: { children: (session: StudentSession) => ReactNode }) {
  const [auth, setAuth] = useState<{ session: StudentSession | null | undefined; version: number }>({
    session: undefined,
    version: 0,
  });

  useEffect(() => {
    const sync = () => {
      const next = getStudentSession();
      setAuth(current => sameSession(current.session, next)
        ? current
        : { session: next, version: current.version + 1 });
    };
    window.addEventListener(STUDENT_AUTH_CHANGED_EVENT, sync);
    window.addEventListener('storage', sync);
    sync();
    return () => {
      window.removeEventListener(STUDENT_AUTH_CHANGED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  if (auth.session) return <Fragment key={auth.version}>{children(auth.session)}</Fragment>;
  return (
    <div className="rounded-2xl border border-sand/60 bg-white p-8 text-center">
      <p role="status">{auth.session === undefined ? '正在检查登录状态…' : '请使用已获本赛事授权的评委账号登录。'}</p>
      {auth.session === null && (
        <button
          type="button"
          className="mt-4 min-h-11 rounded-lg bg-crimson px-5 font-semibold text-white"
          onClick={openJudgeLogin}
        >
          登录评委账号
        </button>
      )}
    </div>
  );
}
