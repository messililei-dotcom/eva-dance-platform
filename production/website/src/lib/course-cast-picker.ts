type CastVideo = {
  webkitShowPlaybackTargetPicker?: () => void;
  remote?: { prompt?: () => Promise<void> };
};

// Keep the native picker call synchronous with the user's tap.
export function openCourseCastPicker(video: CastVideo): Promise<void> {
  if (video.webkitShowPlaybackTargetPicker) {
    video.webkitShowPlaybackTargetPicker();
    return Promise.resolve();
  }
  if (video.remote?.prompt) return video.remote.prompt();
  return Promise.reject(new Error('当前环境不支持直接投屏'));
}
