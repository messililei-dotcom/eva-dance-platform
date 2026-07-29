import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { cleanText, hasAuth, jsonError, unauthorized } from '../../_db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'event-covers');
const URL_PREFIX = '/uploads/event-covers/';
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const MIME_EXTENSION: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

function safeName(value: string) {
  return cleanText(value, 'event-cover').replace(/[\\/:*?"<>|#%&{}$!'@+=`]/g, '-').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 60) || 'event-cover';
}

export async function POST(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return jsonError('请选择赛事封面', 400);
    const extension = MIME_EXTENSION[file.type];
    if (!extension) return jsonError('赛事封面仅支持 JPG、PNG 或 WebP', 400);
    if (file.size > MAX_IMAGE_SIZE) return jsonError('赛事封面不能超过 8MB', 413);
    await mkdir(UPLOAD_DIR, { recursive: true });
    const competitionName = safeName(String(form.get('competitionName') || '赛事封面'));
    const filename = `${competitionName}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extension}`;
    await writeFile(path.join(UPLOAD_DIR, filename), Buffer.from(await file.arrayBuffer()));
    return Response.json({ success: true, data: { coverUrl: `${URL_PREFIX}${encodeURIComponent(filename)}`, filename } });
  } catch (err: any) {
    return jsonError(err?.message || '上传赛事封面失败', 500);
  }
}
