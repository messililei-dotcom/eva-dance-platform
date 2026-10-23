export const HISTORY_SWIPE_MIN_DISTANCE = 72;
export const HISTORY_SWIPE_MAX_DURATION_MS = 900;
export const HISTORY_SWIPE_DIRECTION_RATIO = 1.35;

export type HistorySwipeDirection = 'back' | 'forward';

type HistorySwipeInput = {
  deltaX: number;
  deltaY: number;
  durationMs: number;
};

/**
 * Convert one completed touch gesture into browser-history intent.
 * A horizontal swipe must be both long and clearly more horizontal than
 * vertical so ordinary page scrolling cannot accidentally leave the page.
 */
export function getHistorySwipeDirection({
  deltaX,
  deltaY,
  durationMs,
}: HistorySwipeInput): HistorySwipeDirection | null {
  const horizontalDistance = Math.abs(deltaX);
  const verticalDistance = Math.abs(deltaY);

  if (
    durationMs > HISTORY_SWIPE_MAX_DURATION_MS
    || horizontalDistance < HISTORY_SWIPE_MIN_DISTANCE
    || horizontalDistance < verticalDistance * HISTORY_SWIPE_DIRECTION_RATIO
  ) {
    return null;
  }

  return deltaX > 0 ? 'back' : 'forward';
}
