'use client';

const QUEUE_KEY = 'swod_pending_learning_progress_v1';
const QUEUE_LIMIT = 100;

export type PendingLearningProgress = {
  videoId: string;
  memberId: string;
  progress: number;
  duration: number;
  updatedAt: number;
};

function readQueue(): PendingLearningProgress[] {
  if (typeof window === 'undefined') return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(QUEUE_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeQueue(rows: PendingLearningProgress[]) {
  window.localStorage.setItem(QUEUE_KEY, JSON.stringify(rows.slice(-QUEUE_LIMIT)));
  window.dispatchEvent(new CustomEvent('swod-progress-queue-changed', { detail: rows.length }));
}

/**
 * Network failures are stored device-locally. Repeated samples for the same
 * learner/video are merged so an unstable connection cannot grow the queue.
 */
export function queueLearningProgress(input: Omit<PendingLearningProgress, 'updatedAt'>) {
  if (typeof window === 'undefined') return;
  const rows = readQueue();
  const index = rows.findIndex(row => row.videoId === input.videoId && row.memberId === input.memberId);
  const next: PendingLearningProgress = {
    ...input,
    progress: Math.max(0, Math.floor(input.progress)),
    duration: Math.max(0, Math.floor(input.duration)),
    updatedAt: Date.now(),
  };
  if (index >= 0) {
    next.progress = Math.max(next.progress, Number(rows[index].progress || 0));
    next.duration = Math.max(next.duration, Number(rows[index].duration || 0));
    rows[index] = next;
  } else {
    rows.push(next);
  }
  writeQueue(rows);
}

/** Flushes pending samples with the current session token after reconnection. */
export async function flushLearningProgress(token: string, memberId: string) {
  if (typeof window === 'undefined' || !token || !memberId || !navigator.onLine) return;
  const rows = readQueue();
  const remaining: PendingLearningProgress[] = [];

  for (const row of rows) {
    if (row.memberId !== memberId) {
      remaining.push(row);
      continue;
    }
    try {
      const response = await fetch(`/api/learn/video/${encodeURIComponent(row.videoId)}/progress`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: row.memberId,
          progress: row.progress,
          duration: row.duration,
        }),
        cache: 'no-store',
      });
      if (!response.ok) remaining.push(row);
    } catch {
      remaining.push(row);
    }
  }

  writeQueue(remaining);
}
