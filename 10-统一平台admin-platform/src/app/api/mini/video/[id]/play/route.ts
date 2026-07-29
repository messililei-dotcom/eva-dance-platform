import fs from 'fs';
import { getMemberId, jsonError, recordSeriesVisit, toPositiveInt, withDb } from '../../../_helpers';
import { getVodPlayOptions, isVodVideoMissingError } from '@/lib/server/aliyun-vod';
import {
  isDirectPlayableMediaMaterial,
  localMaterialPath,
  vodPlaybackUnavailableResponse,
} from '../../../../course/_materials';
import { getVideoAccessStatus } from '../../../../course/series/[id]/_authorization';
import { createVideoStreamToken } from '../../_stream-token';

function originOf(request: Request) {
  const configured = process.env.ADMIN_PUBLIC_ORIGIN || process.env.NEXT_PUBLIC_ADMIN_ORIGIN;
  if (configured) return configured.replace(/\/+$/, '');
  const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const forwardedProto = request.headers.get('x-forwarded-proto') || new URL(request.url).protocol.replace(/:$/, '');
  if (forwardedHost) return `${forwardedProto || 'https'}://${forwardedHost}`;
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  try {
    return await withDb(async (db) => {
      const videoId = toPositiveInt(routeParams.id);
      const memberId = getMemberId(new URL(request.url).searchParams, request);
      if (!memberId) return jsonError('未登录', 401);
      const video = db.prepare(
        `SELECT cv.id, cv.material_id, cv.name, cv.duration,
                m.name as material_name, m.type, m.file_path, m.file_url, m.vod_video_id, m.transcode_status, m.duration as material_duration,
                oc.series_id, cs.is_free as series_is_free
         FROM CourseVideo cv
         LEFT JOIN Material m ON cv.material_id=m.id
         LEFT JOIN OnlineCourse oc ON cv.course_id=oc.id
         LEFT JOIN CourseSeries cs ON oc.series_id=cs.id
         WHERE cv.id=?`
      ).get(videoId);
      if (!video) return jsonError('视频不存在', 404);
      const member = db.prepare('SELECT phone FROM Member WHERE id=?').get<{ phone?: string }>(memberId);
      const access = getVideoAccessStatus(db, videoId, memberId, member?.phone || '');
      if (!access.authorized) return jsonError(access.message || '请先申请授权观看完整学习', 403);
      recordSeriesVisit(db, Number(video.series_id || 0), memberId, 'video');
      const rawUrl = video.file_url || video.file_path || '';
      const isRemoteUrl = /^https?:\/\//.test(rawUrl);
      const absolutePath = !isRemoteUrl ? localMaterialPath(rawUrl) : null;
      const hasLocalFile = Boolean(absolutePath && fs.existsSync(absolutePath));
      const isAudio = video.type === 'audio';
      let videoUrl = '';
      let playbackSource = 'local';
      let qualityOptions: Array<{ label: string; value: string; url: string; definition?: string; format?: string }> = [];
      if (video.vod_video_id && !isAudio) {
        try {
          const vodOptions = await getVodPlayOptions(String(video.vod_video_id));
          const preferred = vodOptions.find(item => item.format === 'm3u8')
            || vodOptions.find(item => item.definition === 'od' || item.definition === 'hd')
            || vodOptions.find(item => item.format === 'mp4')
            || vodOptions[0];
          videoUrl = preferred?.url || '';
          qualityOptions = vodOptions.map(item => ({
            label: item.label,
            value: item.value,
            url: item.url,
            definition: item.definition,
            format: item.format,
          }));
          if (videoUrl) {
            playbackSource = 'vod';
            if (!['success', 'completed'].includes(String(video.transcode_status || ''))) {
              db.prepare("UPDATE Material SET transcode_status='success', updated_at=datetime('now','localtime') WHERE id=?").run(video.material_id);
            }
          }
        } catch (err) {
          if (isVodVideoMissingError(err)) {
            db.prepare("UPDATE Material SET transcode_status='failed', updated_at=datetime('now','localtime') WHERE id=?").run(video.material_id);
            return jsonError('VOD视频不存在，请重新上传素材或重新绑定VOD视频', 422);
          }
          videoUrl = '';
          qualityOptions = [];
        }
        if (!videoUrl) {
          return vodPlaybackUnavailableResponse(video);
        }
      }
      if (!videoUrl) {
        if (isRemoteUrl) {
          if (!isDirectPlayableMediaMaterial(video)) {
            return jsonError('该视频源文件格式不适合直接播放，请先转码为 MP4/HLS 或重新上传素材', 415);
          }
          videoUrl = rawUrl;
          playbackSource = 'remote';
        } else if (hasLocalFile) {
          if (!isDirectPlayableMediaMaterial(video)) {
            return jsonError('该视频源文件格式不适合直接播放，请先转码为 MP4/HLS 或重新上传素材', 415);
          }
          videoUrl = `${originOf(request)}/api/mini/video/${videoId}/stream?t=${encodeURIComponent(createVideoStreamToken(videoId, memberId))}`;
          playbackSource = 'local';
        } else {
          const status = String(video.transcode_status || '');
          const waitingForVod = Boolean(video.vod_video_id && ['pending', 'processing'].includes(status));
          const failedVod = Boolean(video.vod_video_id && status === 'failed');
          return jsonError(
            waitingForVod
              ? '视频正在转码，播放地址生成后可观看'
              : failedVod
                ? '视频转码失败，请重新上传素材'
                : '素材源文件不存在，请重新上传或重新绑定素材',
            waitingForVod ? 425 : 404
          );
        }
      }
      if (!qualityOptions.length && videoUrl) {
        qualityOptions = [{ label: '自动', value: 'auto', url: videoUrl }];
      }
      return Response.json({
        success: true,
        data: {
          id: video.id,
          name: video.name,
          type: video.type || 'video',
          material_id: video.material_id,
          vod_video_id: video.vod_video_id || '',
          source: playbackSource,
          playback_source: playbackSource,
          play_url: videoUrl,
          qualities: qualityOptions,
          quality_options: qualityOptions,
          video_url: videoUrl,
          file_path: videoUrl,
          file_url: videoUrl,
          duration: video.duration || video.material_duration || 0,
          authorized: true,
          auth_type: access.auth_type || null,
          access_reason: access.reason,
        },
      });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
