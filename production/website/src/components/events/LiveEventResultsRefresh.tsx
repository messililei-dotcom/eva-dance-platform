'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export const EVENT_RESULTS_REFRESH_MS = 5000;

export default function LiveEventResultsRefresh() {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== 'hidden') router.refresh();
    };
    const timer = window.setInterval(refresh, EVENT_RESULTS_REFRESH_MS);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [router]);
  return null;
}
