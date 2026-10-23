'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** Shared by the website and installed PWA course player. */
export function useLessonCompletion<T>(activeId: string, onNext: (target: T) => void) {
  const [ended, setEnded] = useState(false);
  const [countdown, setCountdown] = useState<{ seconds: number; target: T } | null>(null);
  const nextRef = useRef(onNext);
  nextRef.current = onNext;
  const cancel = useCallback(() => setCountdown(null), []);
  const reset = useCallback(() => { setCountdown(null); setEnded(false); }, []);
  const finish = useCallback((target: T | null) => {
    setEnded(true);
    setCountdown(target && !document.hidden ? { seconds: 5, target } : null);
  }, []);

  useEffect(reset, [activeId, reset]);
  useEffect(() => {
    const hide = () => { if (document.hidden) cancel(); };
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', cancel);
    return () => {
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('pagehide', cancel);
    };
  }, [cancel]);
  useEffect(() => {
    if (!countdown) return;
    const timer = window.setTimeout(() => {
      if (document.hidden) { cancel(); return; }
      if (countdown.seconds <= 1) {
        reset();
        nextRef.current(countdown.target);
      } else setCountdown(current => current ? { ...current, seconds: current.seconds - 1 } : null);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [countdown, cancel, reset]);

  return { ended, countdown, finish, cancel, reset };
}
