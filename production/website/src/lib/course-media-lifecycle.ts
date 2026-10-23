type ReleasableCourseMedia = {
  pause: () => void;
  removeAttribute: (name: string) => void;
  load: () => void;
  srcObject?: MediaProvider | null;
};

export function stopAndReleaseCourseMedia(video: ReleasableCourseMedia) {
  video.pause();
  video.removeAttribute('src');
  try {
    video.srcObject = null;
  } catch {
    // Older Android WebViews may expose a read-only srcObject property.
  }
  // With all direct and child sources removed, load() resets the media element
  // and releases its decoder/audio pipeline instead of selecting another URL.
  video.load();
}
