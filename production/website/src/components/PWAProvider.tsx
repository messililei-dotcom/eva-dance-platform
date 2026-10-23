'use client';

import { useEffect } from 'react';
import { flushLearningProgress } from '@/lib/learning-progress-queue';
import { getStudentSession, STUDENT_AUTH_CHANGED_EVENT } from '@/lib/student-auth';
import { isStandalonePwa, PWA_COURSES_PATH, PWA_HOME_PATH } from '@/lib/pwa-auth-flow';

export default function PWAProvider() {
  useEffect(() => {
    if (!isStandalonePwa()) return;
    const current = `${window.location.pathname}${window.location.search}`;
    // Existing iOS/Android installations can retain the previous manifest
    // start URL. Redirect that legacy launch target to the new personal home.
    if (current === PWA_COURSES_PATH) window.location.replace(PWA_HOME_PATH);
  }, []);

  useEffect(() => {
    const secureContext = window.isSecureContext || ['localhost', '127.0.0.1'].includes(window.location.hostname);
    if (!secureContext || !('serviceWorker' in navigator)) return;

    let disposed = false;
    let refreshing = false;
    const hadController = Boolean(navigator.serviceWorker.controller);
    const handleControllerChange = () => {
      if (disposed || refreshing || !hadController) return;
      refreshing = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((registration) => {
        if (disposed) return;
        registration.update().catch(() => undefined);
        if (registration.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              worker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  useEffect(() => {
    const sync = () => {
      const session = getStudentSession();
      if (session) void flushLearningProgress(session.token, session.id);
    };
    sync();
    window.addEventListener('online', sync);
    window.addEventListener(STUDENT_AUTH_CHANGED_EVENT, sync);
    document.addEventListener('visibilitychange', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener(STUDENT_AUTH_CHANGED_EVENT, sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, []);

  return null;
}
