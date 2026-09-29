import { mkdir, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { hasAuth, unauthorized } from '../../_db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'ecommerce', 'products');
const URL_PREFIX = '/uploads/ecommerce/products/';
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const MIME_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
};

function cleanText(value: unknown, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function safeName(value: unknown) {
  return cleanText(value, 'product')
    .replace(/[\\/:*?"<>|#%&{}$!'@+=`]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60) || 'product';
}

function extensionFromFile(file: File) {
  const mimeExtension = MIME_EXTENSION[file.type || ''];
  if (mimeExtension) return mimeExtension;
  const ext = path.extname(file.name || '').replace('.', '').toLowerCase();
  return /^[a-z0-9]{1,8}$/.test(ext) ? ext : '';
}

async function deleteOldImage(oldPath: unknown) {
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
    if (!(file instanceof File)) return Response.json({ success: false, error: '请选择商品主图' }, { status: 400 });
    if (!file.type?.startsWith('image/')) return Response.json({ success: false, error: '商品主图仅支持图片文件' }, { status: 400 });
    if (file.size > MAX_IMAGE_SIZE) return Response.json({ success: false, error: '商品主图不能超过 8MB' }, { status: 413 });

    const extension = extensionFromFile(file);
    if (!extension) return Response.json({ success: false, error: '无法识别图片格式' }, { status: 400 });

    await mkdir(UPLOAD_DIR, { recursive: true });
    const productName = safeName(form.get('productName'));
    const filename = `${productName}-${Date.now()}.${extension}`;
    await writeFile(path.join(UPLOAD_DIR, filename), Buffer.from(await file.arrayBuffer()));

    const image = `${URL_PREFIX}${encodeURIComponent(filename)}`;
    await deleteOldImage(form.get('oldImage'));
    return Response.json({ success: true, data: { image, url: image, filename } });
  } catch (err: any) {
    return Response.json({ success: false, error: err?.message || '上传商品主图失败' }, { status: 500 });
  }
}
