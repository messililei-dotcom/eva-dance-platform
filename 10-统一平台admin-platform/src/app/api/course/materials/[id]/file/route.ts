import fs from 'fs';
import {
  fileStreamResponse,
  isDirectPlayableVideoMaterial,
  isVideoMaterial,
  jsonError,
  localMaterialPath,
  toPositiveInt,
  vodPlaybackUnavailableResponse,
  withDb,
} from '../../../_materials';
import { hasAuth, unauthorized } from '../../../../training-db';
import { getVodPlayUrl, isVodVideoMissingError } from '@/lib/server/aliyun-vod';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();
  try {
    const material = withDb((db) => db.prepare('SELECT * FROM Material WHERE id=?').get(toPositiveInt(routeParams.id)));
    if (!material) return jsonError('素材不存在', 404);
    if (material.vod_video_id && isVideoMaterial(material)) {
      try {
        const vodUrl = await getVodPlayUrl(String(material.vod_video_id));
        if (vodUrl) {
          if (!['success', 'completed'].includes(String(material.transcode_status || '').toLowerCase())) {
            withDb((db) => {
              db.prepare("UPDATE Material SET transcode_status='success', updated_at=datetime('now','localtime') WHERE id=?").run(material.id);
            });
          }
          return Response.redirect(vodUrl, 302);
        }
      } catch (err) {
        if (isVodVideoMissingError(err)) {
          withDb((db) => {
            db.prepare("UPDATE Material SET transcode_status='failed', updated_at=datetime('now','localtime') WHERE id=?").run(material.id);
          });
          return jsonError('VOD视频不存在，请重新上传素材或重新绑定VOD视频', 422);
        }
        return vodPlaybackUnavailableResponse(material);
      }
      return vodPlaybackUnavailableResponse(material);
    }
    if (material.file_url && /^https?:\/\//.test(material.file_url)) {
      if (isVideoMaterial(material) && !isDirectPlayableVideoMaterial(material)) {
        return jsonError('该视频源文件格式不适合直接播放，请先转码为 MP4/HLS 或重新上传素材', 415);
      }
      return Response.redirect(material.file_url, 302);
    }
    if (isVideoMaterial(material) && !isDirectPlayableVideoMaterial(material)) {
      return jsonError('该视频源文件格式不适合直接播放，请先转码为 MP4/HLS 或重新上传素材', 415);
    }
    const absolutePath = localMaterialPath(material.file_path || material.file_url);
    if (!absolutePath || !fs.existsSync(absolutePath)) return jsonError('素材文件不存在', 404);
    return fileStreamResponse(request, material, absolutePath);
  } catch (err: any) {
    return jsonError(err?.message || '读取素材文件失败');
  }
}
