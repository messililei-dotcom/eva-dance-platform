type PresentationVideo = HTMLVideoElement & {
  webkitPresentationMode?: string;
  webkitSupportsPresentationMode?: (mode: string) => boolean;
  webkitSetPresentationMode?: (mode: string) => void;
};

export async function toggleCoursePictureInPicture(video: PresentationVideo, doc: Document): Promise<void> {
  if (doc.pictureInPictureElement === video && doc.exitPictureInPicture) {
    await doc.exitPictureInPicture();
    return;
  }
  if (video.webkitPresentationMode === 'picture-in-picture' && video.webkitSetPresentationMode) {
    video.webkitSetPresentationMode('inline');
    return;
  }
  if (video.readyState < 1) throw new Error('请先播放课程，加载完成后再点击小窗播放。');
  if (doc.pictureInPictureEnabled && video.requestPictureInPicture) {
    try {
      await video.requestPictureInPicture();
      return;
    } catch {
      // Some embedded browsers expose the API but reject the request.
    }
  }
  if (video.webkitSupportsPresentationMode?.('picture-in-picture') && video.webkitSetPresentationMode) {
    try {
      video.webkitSetPresentationMode('picture-in-picture');
      return;
    } catch {
      // Fall through to instructions without claiming that a window opened.
    }
  }
  throw new Error('当前环境未能开启小窗。微信内可从右上角菜单选择在浏览器打开，再尝试小窗播放；也可使用手机提供的分屏功能。切换时请保留本页面，回来可继续播放。');
}
