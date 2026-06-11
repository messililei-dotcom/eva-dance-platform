import { mkdir, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { cleanText, hasAuth, jsonError, unauthorized } from '../../training-db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'training-courses');
const URL_PREFIX = '/uploads/training-courses/';
const MAX_IMAGE_SIZE = 12 * 1024 * 1024;
const MIME_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
};

function safeName(value: string) {
  return cleanText(value, 'course')
    .replace(/[\\/:*?"<>|#%&{}$!'@+=`]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60) || 'course';
}

function extensionFromFile(file: File) {
  const mimeExtension = MIME_EXTENSION[file.type];
  if (mimeExtension) return mimeExtension;
  const ext = path.extname(file.name || '').replace('.', '').toLowerCase();
  return /^[a-z0-9]{1,8}$/.test(ext) ? ext : '';
}

async function deleteOldCover(oldPath: unknown) {
  const text = cleanText(oldPath);
  if (!text.startsWith(URL_PREFIX)) return;
  const filename = path.basename(decodeURIComponent(text.slice(URL_PREFIX.length)));
  if (!filename) return;
  const absolutePath = path.join(UPLOAD_DIR, filename);
  if (!absolutePath.startsWith(UPLOAD_DIR + path.sep)) return;
  await unlink(absolutePath).catch(() => {});
}

export async function POST(request: Request) {
  if (!hasAuth(request)) return unauthorized();

  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return Response.json({ success: false, error: '请选择课程主图' }, { status: 400 });
    if (!file.type.startsWith('image/')) return Response.json({ success: false, error: '课程主图仅支持图片文件' }, { status: 400 });
    if (file.size > MAX_IMAGE_SIZE) return Response.json({ success: false, error: '课程主图不能超过 12MB' }, { status: 400 });

    const extension = extensionFromFile(file);
    if (!extension) return Response.json({ success: false, error: '无法识别图片扩展名' }, { status: 400 });

    await mkdir(UPLOAD_DIR, { recursive: true });
    const courseName = safeName(String(form.get('courseName') || 'course'));
    const filename = `${courseName}-${Date.now()}.${extension}`;
    const diskPath = path.join(UPLOAD_DIR, filename);
    await writeFile(diskPath, Buffer.from(await file.arrayBuffer()));

    const coverImage = `${URL_PREFIX}${encodeURIComponent(filename)}`;
    await deleteOldCover(form.get('oldCoverImage'));
    return Response.json({ success: true, data: { coverImage, filename } });
  } catch (err: any) {
    return jsonError(err?.message, 500, '上传课程主图失败');
  }
}
