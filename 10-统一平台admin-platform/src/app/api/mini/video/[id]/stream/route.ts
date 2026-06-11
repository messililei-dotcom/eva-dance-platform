import fs from 'fs';
import { getVodPlayUrl } from '@/lib/server/aliyun-vod';
import {
  fileStreamResponse,
  isDirectPlayableMediaMaterial,
  localMaterialPath,
  vodPlaybackUnavailableResponse,
} from '../../../../course/_materials';
import { getActiveAuthorization } from '../../../../course/series/[id]/_authorization';
import { jsonError, toPositiveInt, withDb } from '../../../_helpers';
import { verifyVideoStreamToken } from '../../_stream-token';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  try {
    const videoId = toPositiveInt(routeParams.id);
    const token = new URL(request.url).searchParams.get('t') || '';
    const tokenPayload = verifyVideoStreamToken(token);
    if (!videoId || !tokenPayload || tokenPayload.videoId !== videoId) {
      return jsonError('播放链接已失效，请重新打开课节', 403);
    }

    return await withDb(async (db) => {
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

      const member = db.prepare('SELECT phone FROM Member WHERE id=?').get<{ phone?: string }>(tokenPayload.memberId);
      const auth = video.series_is_free || getActiveAuthorization(db, Number(video.series_id || 0), tokenPayload.memberId, member?.phone || '');
      if (!auth) return jsonError('请先申请授权观看完整学习', 403);

      if (video.vod_video_id && video.type !== 'audio') {
        try {
          const vodUrl = await getVodPlayUrl(String(video.vod_video_id));
          if (vodUrl) return Response.redirect(vodUrl, 302);
        } catch {
          return vodPlaybackUnavailableResponse(video);
        }
        return vodPlaybackUnavailableResponse(video);
      }

      if (video.file_url && /^https?:\/\//.test(video.file_url)) {
        if (!isDirectPlayableMediaMaterial(video)) {
          return jsonError('该视频源文件格式不适合直接播放，请先转码为 MP4/HLS 或重新上传素材', 415);
        }
        return Response.redirect(video.file_url, 302);
      }

      const absolutePath = localMaterialPath(video.file_path || video.file_url || '');
      if (!absolutePath || !fs.existsSync(absolutePath)) return jsonError('素材文件不存在', 404);
      if (!isDirectPlayableMediaMaterial(video)) {
        return jsonError('该视频源文件格式不适合直接播放，请先转码为 MP4/HLS 或重新上传素材', 415);
      }
      return fileStreamResponse(request, video, absolutePath);
    });
  } catch (err: any) {
    return jsonError(err?.message || '读取视频失败');
  }
}
