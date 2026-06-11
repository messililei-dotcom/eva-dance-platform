import path from 'path';
import { jsonError, localMaterialPath, saveThumbnailDataUrl, toPositiveInt, withDb } from '../../../_materials';
import { hasAuth, unauthorized } from '../../../../training-db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  try {
    return withDb((db) => {
      const material = db.prepare('SELECT * FROM Material WHERE id=?').get(toPositiveInt(routeParams.id));
      if (!material) return jsonError('素材不存在', 404);
      if (material.type !== 'video') return jsonError('只有视频素材支持自动生成封面', 400);
      const absoluteFilePath = localMaterialPath(material.file_path || material.file_url);
      if (!absoluteFilePath) return jsonError('素材文件路径无效', 400);
      const thumb = saveThumbnailDataUrl(body.thumbnail_data_url, path.dirname(absoluteFilePath), path.basename(absoluteFilePath));
      if (!thumb) return jsonError('封面图片生成失败', 400);
      const thumbnail = `${path.posix.dirname(material.file_path || material.file_url)}/${thumb.filename}`;
      db.prepare("UPDATE Material SET thumbnail=?, updated_at=datetime('now','localtime') WHERE id=?").run(thumbnail, material.id);
      return Response.json({ success: true, thumbnail });
    });
  } catch (err: any) {
    return jsonError(err?.message || '保存封面失败');
  }
}
