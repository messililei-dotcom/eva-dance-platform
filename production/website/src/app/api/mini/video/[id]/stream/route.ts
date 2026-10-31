import fs from 'fs';
import path from 'path';
import { getAuthenticatedMemberId, jsonError, toPositiveInt, withDb } from '../../../_helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ADMIN_UPLOAD_ROOT = '/www/wwwroot/dongfangwuquan/admin-platform/public';

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

function contentTypeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.mp4' || ext === '.m4v') return 'video/mp4';
  if (ext === '.webm') return 'video/webm';
  if (ext === '.mov') return 'video/quicktime';
  if (ext === '.m4a') return 'audio/mp4';
  if (ext === '.mp3') return 'audio/mpeg';
  return 'application/octet-stream';
}

function streamFile(request: Request, filePath: string): Response {
  const stat = fs.statSync(/* turbopackIgnore: true */ filePath);
  const size = stat.size;
  const range = request.headers.get('range');
  const headers = new Headers({
    'Accept-Ranges': 'bytes',
    'Content-Type': contentTypeFor(filePath),
    'Cache-Control': 'private, max-age=0, no-cache',
  });

  if (!range) {
    headers.set('Content-Length', String(size));
    return new Response(fs.createReadStream(/* turbopackIgnore: true */ filePath) as any, { status: 200, headers });
  }

  const match = range.match(/bytes=(\d*)-(\d*)/);
  if (!match) return new Response(null, { status: 416 });
  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  }

  headers.set('Content-Length', String(end - start + 1));
  headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  return new Response(fs.createReadStream(/* turbopackIgnore: true */ filePath, { start, end }) as any, { status: 206, headers });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const routeParams = await params;
    return withDb((db) => {
      const videoId = toPositiveInt(routeParams.id);
      const memberId = getAuthenticatedMemberId(request, new URL(request.url).searchParams);
      if (!memberId) return jsonError('未登录', 401);
      const video = db.prepare(
        `SELECT cv.id, cv.material_id, m.file_path, m.file_url, oc.series_id, cs.is_free as series_is_free
         FROM CourseVideo cv
         LEFT JOIN Material m ON cv.material_id=m.id
         LEFT JOIN OnlineCourse oc ON cv.course_id=oc.id
         LEFT JOIN CourseSeries cs ON oc.series_id=cs.id
         WHERE cv.id=?`
      ).get(videoId);
      if (!video) return jsonError('视频不存在', 404);
      const member = db.prepare('SELECT phone FROM Member WHERE id=?').get<{ phone?: string }>(memberId);
      const auth = video.series_is_free || db.prepare(
        `SELECT id FROM CourseAuthorization
         WHERE series_id=? AND status='active' AND (member_id=? OR (phone<>'' AND phone=?))
           AND (expire_at IS NULL OR expire_at > datetime('now','localtime')) LIMIT 1`
      ).get(video.series_id, memberId, member?.phone || '');
      if (!auth) return jsonError('请先申请授权观看完整课程', 403);

      const rawUrl = video.file_url || video.file_path || '';
      if (/^https?:\/\//.test(rawUrl)) {
        try {
          const url = new URL(rawUrl);
          if (!['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname)) {
            return Response.redirect(rawUrl, 302);
          }
        } catch {}
      }

      const filePath = firstExistingLocalUploadPath(video.file_url || '', video.file_path || '');
      if (!filePath || !fs.existsSync(/* turbopackIgnore: true */ filePath)) return jsonError('素材文件不存在', 404);
      return streamFile(request, filePath);
    });
  } catch (err: any) {
    return jsonError(err?.message || '读取视频失败');
  }
}
