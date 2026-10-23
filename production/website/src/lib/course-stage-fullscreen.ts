type FullscreenStage = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

// Video-only fullscreen loses the custom controls on iOS and some WebViews.
export async function enterCourseStageFullscreen(stage: FullscreenStage, usePageLayer = false): Promise<'native' | 'page'> {
  if (usePageLayer) return 'page';
  try {
    if (stage.requestFullscreen) { await stage.requestFullscreen(); return 'native'; }
    if (stage.webkitRequestFullscreen) { await stage.webkitRequestFullscreen(); return 'native'; }
  } catch { /* Keep the same player and controls when fullscreen is denied. */ }
  return 'page';
}
