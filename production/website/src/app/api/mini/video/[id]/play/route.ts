import fs from 'fs';
import path from 'path';
import { getAuthenticatedMemberId, getMemberToken, jsonError, toPositiveInt, withDb } from '../../../_helpers';
import { getVodPlayOptions, isVodVideoMissingError } from '@/lib/server/aliyun-vod';

const ADMIN_UPLOAD_ROOT = '/www/wwwroot/dongfangwuquan/admin-platform/public';

function originOf(request: Request) {
  const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
  if (forwardedHost && !forwardedHost.includes('localhost') && !forwardedHost.includes('127.0.0.1')) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '');
  const url = new URL(request.url);
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return 'https://www.swod.com.cn';
  return `${url.protocol}//${url.host}`;
}

function isLocalUploadUrl(value: string): boolean {
  if (!value) return false;
  if (value.startsWith('/uploads/')) return true;
  try {
    const url = new URL(value);
    return ['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname) && url.pathname.startsWith('/uploads/');
  } catch {
    return false;
  }
}

function localUploadPath(value: string): string {
  if (!value) return '';
  let pathname = value;
  try {
    const url = new URL(value);
    if (!['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname)) return '';
    pathname = url.pathname;
  } catch {}

  if (!pathname.startsWith('/uploads/')) return '';
  const decoded = decodeURIComponent(pathname);
  const normalized = path.posix.normalize(decoded);
  if (!normalized.startsWith('/uploads/') || normalized.includes('\0')) return '';
  return `${ADMIN_UPLOAD_ROOT}${normalized}`;
}

function firstExistingLocalUploadPath(...values: string[]) {
  return values
    .map(value => localUploadPath(value || ''))
    .find(filePath => filePath && fs.existsSync(/* turbopackIgnore: true */ filePath)) || '';
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const routeParams = await params;
    return await withDb(async (db) => {
      const videoId = toPositiveInt(routeParams.id);
      const url = new URL(request.url);
      const memberId = getAuthenticatedMemberId(request, url.searchParams);
      if (!memberId) return jsonError('未登录', 401);
      const video = db.prepare(
        `SELECT cv.id, cv.material_id, cv.name, cv.duration,
                m.file_path, m.file_url, m.vod_video_id, m.transcode_status, m.duration as material_duration,
                oc.series_id, cs.is_free as series_is_free
         FROM CourseVideo cv
         LEFT JOIN Material m ON cv.material_id=m.id
         LEFT JOIN OnlineCourse oc ON cv.course_id=oc.id
         LEFT JOIN CourseSeries cs ON oc.series_id=cs.id
         WHERE cv.id=?`
      ).get(videoId);
      if (!video) return jsonError('视频不存在', 404);
      const member = memberId ? db.prepare('SELECT phone FROM Member WHERE id=?').get(memberId) : null;
      const auth = video.series_is_free || db.prepare(
        `SELECT id FROM CourseAuthorization
         WHERE series_id=? AND status='active' AND (member_id=? OR (phone<>'' AND phone=?))
           AND (expire_at IS NULL OR expire_at > datetime('now','localtime')) LIMIT 1`
      ).get(video.series_id, memberId, member?.phone || '');
      if (!auth) return jsonError('请先申请授权观看完整课程', 403);
      const rawUrl = video.file_url || video.file_path || '';
      let videoUrl = '';
      let playbackSource = 'local';
      let qualityOptions: Array<{ label: string; value: string; url: string; definition?: string; format?: string }> = [];

      if (video.vod_video_id) {
        try {
          const vodOptions = await getVodPlayOptions(String(video.vod_video_id));
          const preferred = vodOptions.find(item => item.format === 'm3u8')
            || vodOptions.find(item => item.definition === 'od' || item.definition === 'hd')
            || vodOptions.find(item => item.format === 'mp4')
            || vodOptions[0];
          videoUrl = preferred?.url || '';
          const vodDuration = Math.max(...vodOptions.map(item => Number(item.duration || 0)), 0);
          qualityOptions = vodOptions.map(item => ({
            label: item.label,
            value: item.value,
            url: item.url,
            definition: item.definition,
            format: item.format,
          }));
          if (videoUrl) {
            playbackSource = 'vod';
            if (vodDuration > 0 && (!Number(video.duration || 0) || !Number(video.material_duration || 0))) {
              const nextDuration = Math.round(vodDuration);
              db.prepare('UPDATE CourseVideo SET duration=? WHERE id=?').run(nextDuration, video.id);
              if (video.material_id) {
                db.prepare('UPDATE Material SET duration=? WHERE id=?').run(nextDuration, video.material_id);
              }
              video.duration = nextDuration;
              video.material_duration = nextDuration;
            }
            if (String(video.transcode_status || '').toLowerCase() !== 'success' && video.material_id) {
              db.prepare("UPDATE Material SET transcode_status='success' WHERE id=?").run(video.material_id);
            }
          }
        } catch (err) {
          if (isVodVideoMissingError(err)) {
            db.prepare("UPDATE Material SET transcode_status='failed' WHERE id=?").run(video.material_id);
            return jsonError('VOD视频不存在，请重新上传素材或重新绑定VOD视频', 422);
          }
          videoUrl = '';
          qualityOptions = [];
        }
      }

      if (!videoUrl) {
        const localPath = firstExistingLocalUploadPath(video.file_url || '', video.file_path || '');
        if (isLocalUploadUrl(rawUrl)) {
          if (localPath && !fs.existsSync(/* turbopackIgnore: true */ localPath)) {
            if (video.material_id) {
              db.prepare("UPDATE Material SET transcode_status='failed' WHERE id=?").run(video.material_id);
            }
            return jsonError('素材源文件不存在，请重新上传或重新绑定素材', 404);
          }
          videoUrl = `${originOf(request)}/api/mini/video/${videoId}/stream?member_id=${encodeURIComponent(String(memberId))}&token=${encodeURIComponent(getMemberToken(request, url.searchParams))}`;
          playbackSource = 'local';
        } else if (/^https?:\/\//.test(rawUrl)) {
          videoUrl = rawUrl;
          playbackSource = 'remote';
        } else if (rawUrl) {
          videoUrl = `${originOf(request)}${rawUrl}`;
        } else {
          return jsonError('素材源文件不存在，请重新上传或重新绑定素材', 404);
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
          material_id: video.material_id,
          vod_video_id: video.vod_video_id || '',
          source: playbackSource,
          playback_source: playbackSource,
          video_url: videoUrl,
          play_url: videoUrl,
          file_path: videoUrl,
          file_url: videoUrl,
          qualities: qualityOptions,
          quality_options: qualityOptions,
          duration: video.duration || video.material_duration || 0,
          authorized: true,
        },
      });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
