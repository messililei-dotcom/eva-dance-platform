'use client';

import { getStudentSession } from '@/lib/student-auth';

export type PushSetupResult =
  | { status: 'subscribed'; subscription: PushSubscription }
  | { status: 'unsupported' | 'denied' | 'not-configured' };

function decodeVapidKey(value: string) {
  const normalized = `${value}${'='.repeat((4 - value.length % 4) % 4)}`.replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(normalized);
  return Uint8Array.from([...raw].map(char => char.charCodeAt(0)));
}

/**
 * Reserved Web Push entry point. Call only from an explicit user action.
 * Set NEXT_PUBLIC_WEB_PUSH_VAPID_KEY when the notification service is ready.
 */
export async function enableLearningNotifications(): Promise<PushSetupResult> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return { status: 'unsupported' };
  }
  const key = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_KEY;
  if (!key) return { status: 'not-configured' };
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { status: 'denied' };

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: decodeVapidKey(key),
  });
  const session = getStudentSession();
  await fetch('/api/pwa/push/subscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
    },
    body: JSON.stringify(subscription),
    credentials: 'same-origin',
  });
  return { status: 'subscribed', subscription };
}
