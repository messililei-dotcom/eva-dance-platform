import fsp from 'fs/promises';
import path from 'path';
import { cleanText, jsonError, safeName, uploadUrl, uniqueDiskName } from '../../_materials';
import { hasAuth, unauthorized } from '../../../training-db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const COVER_SEGMENTS = ['online-course', 'series-covers'];
const COVER_ROOT = path.join(process.cwd(), 'public', 'uploads', ...COVER_SEGMENTS);
const COVER_URL_PREFIX = uploadUrl(...COVER_SEGMENTS) + '/';
const COVER_API_PREFIX = '/api/course/series/cover/';
const MAX_IMAGE_SIZE = 2 * 1024 * 1024;
const MIME_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/svg+xml': 'svg',
};

function extensionFromFile(file: File) {
  const mimeExtension = MIME_EXTENSION[file.type || ''];
  if (mimeExtension) return mimeExtension;
  const ext = path.extname(file.name || '').replace('.', '').toLowerCase();
  return /^[a-z0-9]{1,8}$/.test(ext) ? ext : '';
}

async function deleteOldCover(oldPath: unknown) {
  const text = cleanText(oldPath);
  const source = text.startsWith(COVER_URL_PREFIX)
    ? text.slice(COVER_URL_PREFIX.length)
    : text.startsWith(COVER_API_PREFIX)
      ? text.slice(COVER_API_PREFIX.length)
      : '';
  if (!source) return;
  const filename = path.basename(decodeURIComponent(source));
  if (!filename) return;
  const absolutePath = path.join(COVER_ROOT, filename);
  if (!absolutePath.startsWith(COVER_ROOT + path.sep)) return;
  await fsp.unlink(absolutePath).catch(() => {});
}

export async function POST(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) return jsonError('请选择课程主图', 400);
    if (!file.type?.startsWith('image/')) return jsonError('课程主图仅支持图片文件', 400);
    if (file.size > MAX_IMAGE_SIZE) return jsonError('图片太大，不能超过2M', 413);

    const extension = extensionFromFile(file);
    if (!extension) return jsonError('无法识别图片格式', 400);

    await fsp.mkdir(COVER_ROOT, { recursive: true });
    const courseName = safeName(cleanText(formData.get('courseName'), '课程主图'));
    const diskName = await uniqueDiskName(COVER_ROOT, `${courseName}-${Date.now()}.${extension}`);
    await fsp.writeFile(path.join(COVER_ROOT, diskName), Buffer.from(await file.arrayBuffer()));

    const coverImage = `${COVER_API_PREFIX}${encodeURIComponent(diskName)}`;
    await deleteOldCover(formData.get('oldCoverImage'));
    return Response.json({ success: true, data: { coverImage, filename: diskName } });
  } catch (err: any) {
    return jsonError(err?.message || '上传课程主图失败');
  }
}
