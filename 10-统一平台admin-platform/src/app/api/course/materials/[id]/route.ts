import { cleanText, deleteLocalMaterialFiles, ensureDefaultMaterialFolder, jsonError, materialFolderById, toPositiveInt, withDb } from '../../_materials';
import { hasAuth, unauthorized } from '../../../training-db';
import { deleteVodVideos, updateVodVideoInfo } from '@/lib/server/aliyun-vod';
import { recordMaterialDeletionTombstones } from '@/lib/server/material-deletion-tombstones';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();
  try {
    return withDb((db) => {
      const material = db.prepare('SELECT * FROM Material WHERE id=?').get(toPositiveInt(routeParams.id));
      if (!material) return jsonError('素材不存在', 404);
      return Response.json({ success: true, data: material });
    });
  } catch (err: any) {
    return jsonError(err?.message || '获取素材失败');
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  try {
    const id = toPositiveInt(routeParams.id);
    const before = withDb((db) => db.prepare('SELECT * FROM Material WHERE id=?').get(id));
    if (!before) return jsonError('素材不存在', 404);

    const nextName = body.name !== undefined ? cleanText(body.name) : String(before.name || '');
    const nextVodVideoId = body.vod_video_id !== undefined
      ? cleanText(body.vod_video_id)
      : body.video_id !== undefined
        ? cleanText(body.video_id)
        : cleanText(before.vod_video_id);
    const isVideo = String(before.type || '') === 'video';
    if (isVideo && !nextVodVideoId) {
      return jsonError('视频素材必须绑定 VOD ID，不能保存为系统硬盘视频素材', 400);
    }
    const nextFilePath = body.file_path !== undefined ? cleanText(body.file_path) : cleanText(before.file_path);
    const nextFileUrl = body.file_url !== undefined ? cleanText(body.file_url) : cleanText(before.file_url);
    if (isVideo) {
      const invalidLocalPath = [nextFilePath, nextFileUrl].some(value => value && !value.startsWith('vod:'));
      if (invalidLocalPath) {
        return jsonError('视频素材文件路径必须使用 VOD，不允许填写系统硬盘路径', 400);
      }
    }
    let vodSynced = false;
    if (nextVodVideoId && body.name !== undefined && nextName !== String(before.name || '')) {
      await updateVodVideoInfo({
        videoId: nextVodVideoId,
        title: nextName,
        tags: body.tags !== undefined ? cleanText(body.tags) : undefined,
        coverUrl: body.thumbnail !== undefined ? cleanText(body.thumbnail) : undefined,
      });
      vodSynced = true;
    }

    return withDb((db) => {
      const updates: string[] = [];
      const values: any[] = [];
      if (body.folder_id !== undefined) {
        const requestedFolderId = toPositiveInt(body.folder_id, 0);
        const folder = requestedFolderId > 0 ? materialFolderById(db, requestedFolderId) : ensureDefaultMaterialFolder(db);
        if (!folder) return jsonError('目标文件夹不存在', 404);
        updates.push('folder_id=?');
        values.push(Number(folder.id));
      }
      ['name', 'tags', 'file_path', 'duration', 'thumbnail', 'vod_media_id', 'vod_video_id'].forEach((key) => {
        if (body[key] !== undefined) {
          updates.push(`${key}=?`);
          const nextValue = key === 'file_path' && isVideo && !cleanText(body[key])
            ? `vod:${nextVodVideoId}`
            : body[key];
          values.push(key === 'duration' ? Number(nextValue || 0) : cleanText(nextValue));
        }
      });
      if (body.file_url !== undefined) {
        updates.push('file_url=?');
        values.push(isVideo ? '' : cleanText(body.file_url));
      }
      if (!updates.length) return Response.json({ success: true, message: '无需更新' });
      updates.push("updated_at=datetime('now','localtime')");
      const result = db.prepare(`UPDATE Material SET ${updates.join(', ')} WHERE id=?`).run(...values, id);
      if (!result.changes) return jsonError('素材不存在', 404);
      return Response.json({ success: true, vod_synced: vodSynced });
    });
  } catch (err: any) {
    return jsonError(err?.message || '更新素材失败');
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();
  try {
    const id = toPositiveInt(routeParams.id);
    const material = withDb((db) => {
      const material = db.prepare('SELECT id, name, file_path, file_url, thumbnail, vod_video_id FROM Material WHERE id=?').get(id);
      if (!material) return jsonError('素材不存在', 404);
      const refs = db.prepare('SELECT COUNT(*) as count FROM CourseVideo WHERE material_id=?').get(id)?.count || 0;
      if (refs > 0) return jsonError(`该素材已被 ${refs} 个课程视频引用，请先解除关联`, 400);
      return material;
    });
    if (material instanceof Response) return material;

    const vodVideoId = cleanText((material as any).vod_video_id);
    if (vodVideoId) await deleteVodVideos([vodVideoId]);

    const response = withDb((db) => {
      const result = db.transaction(() => {
        const tombstoned = recordMaterialDeletionTombstones(db, [material]);
        const deleted = db.prepare('DELETE FROM Material WHERE id=?').run(id).changes;
        return { tombstoned, deleted };
      })();
      if (result.deleted !== 1) return jsonError('素材删除失败，请刷新后重试', 409);
      return Response.json({ success: true, deleted: result.deleted, tombstoned: result.tombstoned, vod_synced: Boolean(vodVideoId) });
    });
    await deleteLocalMaterialFiles([material]);
    return response;
  } catch (err: any) {
    return jsonError(err?.message || '删除素材失败');
  }
}
