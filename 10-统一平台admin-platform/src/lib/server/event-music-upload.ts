import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

export const MAX_EVENT_MUSIC = 10 * 1024 * 1024;
export class MusicUploadError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
const fields = ['groupId', 'name', 'phone', 'organization', 'teacher', 'performanceTitle', 'remark', 'musicFileName'];
export async function normalizedMusicForm(request: Request): Promise<FormData> {
  if (!request.headers.get('content-type')?.startsWith('multipart/form-data;')) throw new MusicUploadError('请选择参赛音乐文件');
  const reader = request.body?.getReader();
  if (!reader) throw new MusicUploadError('请选择参赛音乐文件');
  let size = 0; const chunks: Uint8Array[] = [];
  while (true) {
    const part = await reader.read(); if (part.done) break;
    size += part.value.byteLength;
    if (size > MAX_EVENT_MUSIC + 64 * 1024) { await reader.cancel(); throw new MusicUploadError('音乐文件不能超过10MB', 413); }
    chunks.push(part.value);
  }
  let parsed: FormData;
  try { parsed = await new Request(request.url, { method: 'POST', headers: { 'content-type': request.headers.get('content-type')! }, body: new Uint8Array(Buffer.concat(chunks)) }).formData(); }
  catch { throw new MusicUploadError('音乐上传格式无效，请重新选择文件'); }
  const result = new FormData();
  for (const field of fields) {
    const values = parsed.getAll(field);
    if (values.length > 1 || values.some(value => typeof value !== 'string' || value.length > 1000)) throw new MusicUploadError('报名资料格式无效');
    if (values[0] !== undefined) result.set(field, values[0]);
  }
  const files = parsed.getAll('musicFile');
  if (files.length !== 1 || !(files[0] instanceof File) || files[0].size <= 0) throw new MusicUploadError('请选择一个有效的音乐文件');
  if (files[0].size > MAX_EVENT_MUSIC) throw new MusicUploadError('音乐文件不能超过10MB', 413);
  const originalName = String(result.get('musicFileName') || '').trim();
  result.set('musicFile', originalName ? new File([await files[0].arrayBuffer()], path.basename(originalName), {type:files[0].type}) : files[0]);
  return result;
}
export function validateMusicBytes(name: string, bytes: Buffer): string {
  const extension = path.extname(name).toLowerCase();
  const header = bytes.subarray(0, 12);
  const frame = header.length >= 2 && header[0] === 0xff && (header[1] & 0xe0) === 0xe0;
  const matches = extension === '.mp3' ? (header.subarray(0, 3).toString() === 'ID3' || frame)
    : extension === '.wav' ? (header.subarray(0, 4).toString() === 'RIFF' && header.subarray(8, 12).toString() === 'WAVE')
    : extension === '.m4a' ? (header.subarray(4, 8).toString() === 'ftyp')
    : extension === '.aac' ? (header.length >= 2 && header[0] === 0xff && (header[1] & 0xf6) === 0xf0)
    : extension === '.flac' ? header.subarray(0, 4).toString() === 'fLaC' : false;
  if (bytes.length < 12 || bytes.length > MAX_EVENT_MUSIC || !matches) throw new MusicUploadError('音乐格式无效，请选择 MP3、WAV、M4A、AAC 或 FLAC');
  return extension;
}
export function persistEventMusic(name: string, bytes: Buffer) {
  const extension = validateMusicBytes(name, bytes);
  const root = path.resolve(process.env.EVENT_MUSIC_UPLOAD_ROOT || path.join(process.cwd(), 'private/event-music'));
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  const basename = crypto.randomUUID() + extension;
  const file = path.join(root, basename);
  fs.writeFileSync(file, bytes, { flag: 'wx', mode: 0o600 });
  return { file, fileURL: '/uploads/event-music/' + basename, name: path.basename(name).replace(/[\x00-\x1f]/g, '').slice(0, 120) };
}
