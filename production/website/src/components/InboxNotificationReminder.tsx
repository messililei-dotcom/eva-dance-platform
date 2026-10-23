'use client';

import { useEffect, useRef } from 'react';
import { isStandalonePwa } from '@/lib/pwa-auth-flow';
import { studentApi } from '@/lib/student-api';
import { getStudentSession } from '@/lib/student-auth';

const REMINDER_ENABLED_KEY = 'swod-inbox-notifications';

export default function InboxNotificationReminder() {
  const previousCountRef = useRef<number | null>(null);
  const memberIdRef = useRef('');

  useEffect(() => {
    if (!isStandalonePwa() || !('Notification' in window)) return;

    let active = true;
    const checkForNewMessages = async () => {
      const session = getStudentSession();
      if (!session?.id) {
        memberIdRef.current = '';
        previousCountRef.current = null;
        return;
      }
      if (memberIdRef.current !== session.id) {
        memberIdRef.current = session.id;
        previousCountRef.current = null;
      }
      try {
        const currentCount = await studentApi.getUnreadMessageCount();
        if (!active) return;
        const previousCount = previousCountRef.current;
        previousCountRef.current = currentCount;
        if (
          previousCount === null
          || currentCount <= previousCount
          || window.localStorage.getItem(REMINDER_ENABLED_KEY) !== 'enabled'
          || Notification.permission !== 'granted'
        ) return;

        const body = currentCount === 1 ? '您有 1 条新通知' : `您有 ${currentCount} 条未读通知`;
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification('伊娃东方舞 · 新通知', {
          body,
          icon: '/icons/pwa/icon-192-20261005.png',
          badge: '/icons/pwa/icon-192-20261005.png',
          data: { url: '/dashboard/messages' },
          tag: 'swod-inbox',
        });
      } catch {
        // A failed refresh must not affect the student's current page.
      }
    };

    void checkForNewMessages();
    const timer = window.setInterval(() => { void checkForNewMessages(); }, 60_000);
    const refresh = () => { void checkForNewMessages(); };
    window.addEventListener('focus', refresh);
    window.addEventListener('student-inbox-changed', refresh);
    window.addEventListener('student-inbox-reminders-enabled', refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('student-inbox-changed', refresh);
      window.removeEventListener('student-inbox-reminders-enabled', refresh);
    };
  }, []);

  return null;
}
