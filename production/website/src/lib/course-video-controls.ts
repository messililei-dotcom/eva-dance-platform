export function playbackLevelFromVerticalDrag(
  startValue: number,
  startY: number,
  currentY: number,
  stageHeight: number,
  min: number,
  max: number,
): number {
  const effectiveHeight = Math.max(1, stageHeight * 0.6);
  const nextValue = startValue + (startY - currentY) / effectiveHeight;
  return Math.min(max, Math.max(min, nextValue));
}

export function isIntentionalVerticalPlaybackGesture(
  horizontalDelta: number,
  verticalDelta: number,
  threshold = 12,
): boolean {
  const horizontalDistance = Math.abs(horizontalDelta);
  const verticalDistance = Math.abs(verticalDelta);
  return verticalDistance >= threshold && verticalDistance > horizontalDistance * 1.15;
}
