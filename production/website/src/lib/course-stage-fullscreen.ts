type FullscreenStage = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
type FullscreenDocument = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> | void };

export function courseFullscreenElement(doc: FullscreenDocument): Element | null {
  return doc.fullscreenElement || doc.webkitFullscreenElement || null;
}
export async function exitCourseStageFullscreen(doc: FullscreenDocument): Promise<void> {
  if (doc.fullscreenElement && doc.exitFullscreen) await doc.exitFullscreen();
  else if (doc.webkitFullscreenElement && doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
}
// Keep picture, watermark and custom controls together on every browser.
export async function enterCourseStageFullscreen(stage: FullscreenStage, usePageLayer = false): Promise<'native' | 'page'> {
  if (usePageLayer) return 'page';
  try {
    if (stage.requestFullscreen) { await stage.requestFullscreen(); return 'native'; }
    if (stage.webkitRequestFullscreen) { await stage.webkitRequestFullscreen(); return 'native'; }
  } catch { /* Fall back without replacing or restarting the video. */ }
  return 'page';
}
export async function orientCourseFullscreen(direction: 'landscape' | 'portrait'): Promise<boolean> {
  const orientation = screen.orientation as ScreenOrientation & { lock?: (value: 'landscape' | 'portrait') => Promise<void> };
  try {
    if (!orientation?.lock) return false;
    await orientation.lock(direction);
    return true;
  } catch { return false; }
}
export function unlockCourseOrientation(): void {
  try { screen.orientation?.unlock?.(); } catch { /* Optional in embedded browsers. */ }
}
