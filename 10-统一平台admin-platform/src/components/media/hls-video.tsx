'use client';

import Hls, { ErrorTypes } from 'hls.js';
import { useEffect, useRef } from 'react';

type HlsVideoProps = Omit<React.VideoHTMLAttributes<HTMLVideoElement>, 'src' | 'onError'> & {
  src: string;
  useHls?: boolean;
  onPlaybackError?: (message: string) => void;
};

export function HlsVideo({
  src,
  useHls = true,
  onPlaybackError,
  ...videoProps
}: HlsVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const errorCallbackRef = useRef(onPlaybackError);

  useEffect(() => {
    errorCallbackRef.current = onPlaybackError;
  }, [onPlaybackError]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    let hls: Hls | null = null;
    let networkRecoveries = 0;
    let mediaRecoveries = 0;
    const reportError = (message: string) => errorCallbackRef.current?.(message);
    const handleNativeError = () => reportError('视频加载失败，请刷新后重试；若仍失败，请检查素材转码状态。');

    video.addEventListener('error', handleNativeError);

    if (!useHls) {
      video.src = src;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari supports HLS natively.
      video.src = src;
    } else if (Hls.isSupported()) {
      // Chrome and Edge use Media Source Extensions through hls.js.
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
      });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        if (data.type === ErrorTypes.NETWORK_ERROR && networkRecoveries < 2) {
          networkRecoveries += 1;
          hls?.startLoad();
          return;
        }
        if (data.type === ErrorTypes.MEDIA_ERROR && mediaRecoveries < 1) {
          mediaRecoveries += 1;
          hls?.recoverMediaError();
          return;
        }
        reportError('HLS 视频播放失败，请刷新后重试；若仍失败，请检查网络或素材转码状态。');
        hls?.destroy();
        hls = null;
      });
    } else {
      reportError('当前浏览器不支持 HLS 视频播放，请升级浏览器后重试。');
    }

    return () => {
      video.removeEventListener('error', handleNativeError);
      hls?.destroy();
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [src, useHls]);

  return <video ref={videoRef} {...videoProps} />;
}

export default HlsVideo;
