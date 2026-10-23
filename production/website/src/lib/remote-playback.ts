export type RemotePlaybackAvailability = 'unknown' | 'available' | 'unavailable';

export function isAndroidUserAgent(userAgent: string) {
  return /Android|HarmonyOS/i.test(userAgent);
}

export function isAppleMobileUserAgent(userAgent: string, maxTouchPoints = 0) {
  return /iPhone|iPad|iPod/i.test(userAgent)
    || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1);
}

export function remotePlaybackSourceType(src: string) {
  let pathname = src.toLowerCase();
  try {
    pathname = new URL(src, 'https://www.swod.com.cn').pathname.toLowerCase();
  } catch {
    // Fall back to inspecting the raw value.
  }
  if (pathname.endsWith('.m3u8')) return 'application/vnd.apple.mpegurl';
  if (pathname.endsWith('.webm')) return 'video/webm';
  if (pathname.endsWith('.mov')) return 'video/quicktime';
  return 'video/mp4';
}

export function remotePlaybackErrorMessage(error: unknown, androidFallback = false) {
  const name = error instanceof DOMException
    ? error.name
    : typeof error === 'object' && error && 'name' in error
      ? String((error as { name?: unknown }).name || '')
      : '';

  switch (name) {
    case 'NotFoundError':
      return '未找到可用设备，请确认手机与电视连接同一 Wi-Fi，并开启电视投屏';
    case 'InvalidAccessError':
    case 'NotAllowedError':
      return '请直接点击投屏按钮，并允许浏览器查找局域网投屏设备';
    case 'NotSupportedError':
      return androidFallback
        ? '当前浏览器不支持网页投屏，请使用系统“无线投屏/多屏协同”，或用最新版 Chrome 打开'
        : '当前浏览器或视频格式暂不支持投屏';
    case 'AbortError':
      return '已取消选择投屏设备';
    case 'OperationError':
      return '投屏设备选择窗口已打开，请先完成或关闭当前选择';
    case 'InvalidStateError':
      return '投屏状态异常，请刷新页面后重试';
    default:
      return androidFallback
        ? '投屏启动失败，请检查同一 Wi-Fi、电视投屏开关和浏览器权限'
        : '投屏启动失败，请检查设备和网络';
  }
}

export const ANDROID_SYSTEM_CAST_MESSAGE =
  '当前浏览器不支持网页内投屏：请打开手机控制中心的“无线投屏/多屏协同”，或用最新版 Chrome 打开本页';
