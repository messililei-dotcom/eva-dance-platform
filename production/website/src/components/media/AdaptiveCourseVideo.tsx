'use client';

import { useEffect } from 'react';
import Hls, { ErrorTypes } from 'hls.js';
import type { RefObject, VideoHTMLAttributes } from 'react';
import { remotePlaybackSourceType } from '@/lib/remote-playback';
import { stopAndReleaseCourseMedia } from '@/lib/course-media-lifecycle';

type AdaptiveCourseVideoProps = Omit<VideoHTMLAttributes<HTMLVideoElement>, 'src'> & {
  src: string;
  videoRef: RefObject<HTMLVideoElement>;
};

function isHlsSource(src: string) {
  try {
    return new URL(src, window.location.href).pathname.toLowerCase().endsWith('.m3u8');
  } catch {
    return src.toLowerCase().includes('.m3u8');
  }
}

export default function AdaptiveCourseVideo({
  src,
  videoRef,
  ...videoProps
}: AdaptiveCourseVideoProps) {
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    let hls: Hls | null = null;
    let recoveryTimer = 0;
    let destroyed = false;
    const remoteSource = document.createElement('source');
    remoteSource.src = src;
    remoteSource.type = remotePlaybackSourceType(src);
    remoteSource.dataset.remotePlaybackSource = 'true';
    video.appendChild(remoteSource);

    const clearRecoveryTimer = () => {
      if (recoveryTimer) window.clearTimeout(recoveryTimer);
      recoveryTimer = 0;
    };

    const recoverStalledPlayback = () => {
      if (destroyed || video.paused || video.ended || video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) return;
      if (hls) {
        hls.startLoad();
        return;
      }
      // Native HLS owns buffering and retries. Calling load() here discards
      // its buffer and frame, resets currentTime to zero and only seeks back
      // after metadata arrives. A slow connection must not restart the lesson.
    };

    const scheduleRecovery = () => {
      clearRecoveryTimer();
      // Only HLS.js needs our explicit network retry. Native playback must
      // retain its current media resource and position while buffering.
      if (!hls || video.paused || video.ended) return;
      recoveryTimer = window.setTimeout(recoverStalledPlayback, 8000);
    };

    const markHealthy = () => {
      clearRecoveryTimer();
    };

    video.addEventListener('waiting', scheduleRecovery);
    video.addEventListener('stalled', scheduleRecovery);
    video.addEventListener('playing', markHealthy);
    video.addEventListener('canplay', markHealthy);

    if (!isHlsSource(src)) {
      video.src = src;
      video.load();
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // iPhone and iPad use Safari's native HLS implementation. Keeping this
      // path avoids MediaSource memory pressure on iPadOS.
      video.src = src;
      video.load();
    } else if (Hls.isSupported()) {
      hls = new Hls({
        startLevel: 0,
        capLevelToPlayerSize: true,
        maxBufferLength: 45,
        maxMaxBufferLength: 90,
        backBufferLength: 30,
        fragLoadingMaxRetry: 5,
        manifestLoadingMaxRetry: 4,
        levelLoadingMaxRetry: 4,
      });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        if (data.type === ErrorTypes.NETWORK_ERROR) {
          hls?.startLoad();
          return;
        }
        if (data.type === ErrorTypes.MEDIA_ERROR) {
          hls?.recoverMediaError();
          return;
        }
        hls?.destroy();
        hls = null;
      });
    } else {
      video.src = src;
      video.load();
    }

    return () => {
      destroyed = true;
      clearRecoveryTimer();
      video.removeEventListener('waiting', scheduleRecovery);
      video.removeEventListener('stalled', scheduleRecovery);
      video.removeEventListener('playing', markHealthy);
      video.removeEventListener('canplay', markHealthy);
      hls?.stopLoad();
      hls?.destroy();
      hls = null;
      remoteSource.remove();
      stopAndReleaseCourseMedia(video);
    };
  }, [src, videoRef]);

  return <video ref={videoRef} {...videoProps} />;
}
