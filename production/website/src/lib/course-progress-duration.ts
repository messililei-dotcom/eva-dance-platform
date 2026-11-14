// Media metadata belongs to the sampled lesson; component state may still
// describe the previous lesson during a switch or an unmount pause event.
export function courseProgressDuration(mediaDuration: number, savedDuration: number, fallbackDuration = 0): number {
  for (const value of [mediaDuration, savedDuration, fallbackDuration]) {
    if (Number.isFinite(value) && value > 0) return Math.floor(value);
  }
  return 0;
}
