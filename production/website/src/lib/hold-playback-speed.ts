/** Temporary speed never changes the learner's selected/default playback rate. */
export function createHoldPlaybackSpeed(getMedia: () => { paused: boolean; ended: boolean; playbackRate: number } | null, onActive: (active: boolean) => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let media: ReturnType<typeof getMedia> = null;
  let originalRate = 1;
  let x = 0, y = 0, active = false, suppressUntil = 0;
  const end = (notify = true) => {
    clearTimeout(timer); timer = undefined;
    if (active && media) {
      media.playbackRate = originalRate;
      suppressUntil = Date.now() + 350;
    }
    const wasActive = active;
    active = false; media = null;
    if (wasActive && notify) onActive(false);
  };
  return {
    begin(startX: number, startY: number) {
      end();
      const candidate = getMedia();
      if (!candidate || candidate.paused || candidate.ended) return;
      x = startX; y = startY; media = candidate;
      timer = setTimeout(() => {
        timer = undefined;
        if (media !== candidate || getMedia() !== candidate || candidate.paused || candidate.ended) { end(); return; }
        originalRate = candidate.playbackRate;
        candidate.playbackRate = 2;
        active = true; onActive(true);
      }, 400);
    },
    move(nextX: number, nextY: number) { if (Math.max(Math.abs(nextX - x), Math.abs(nextY - y)) > 12) end(); },
    end,
    suppressClick: () => active || Date.now() < suppressUntil,
  };
}
