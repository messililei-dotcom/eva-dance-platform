import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { archiveEventAudio, deleteEventAudio } from './aliyun-vod';
const run = promisify(execFile);
const root = process.env.EVENT_MUSIC_UPLOAD_ROOT || '/www/wwwroot/dongfangwuquan/admin-platform/public/uploads/event-music';
function safe(value: string, limit = 110) {
  const cleaned = value.trim().replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-').replace(/\s+/g, ' ');
  let text = ''; for (const char of cleaned) { if (Buffer.byteLength(text + char) > limit) break; text += char; }
  return text || '未命名';
}
export async function persistEventMusic(file: File, eventId: number, eventName: string, group: string, name: string, title: string) {
  const fileName = `${safe(group)}-${safe(name, 55)}-${safe(title, 70)}${path.extname(file.name).toLowerCase()}`;
  // UUID directory avoids overwriting identical names while keeping the file name exact.
  const parts = [`${eventId}-${safe(eventName)}`, crypto.randomUUID()];
  const dir = path.join(root, ...parts); await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, fileName); await fs.writeFile(filePath, Buffer.from(await file.arrayBuffer()));
  try {
    const { stdout } = await run(process.env.FFPROBE_PATH || 'ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type', '-of', 'json', filePath], { timeout: 15000, maxBuffer: 256 * 1024 });
    const media = JSON.parse(stdout), duration = Number(media.format?.duration);
    if (!media.streams?.some((stream: any) => stream.codec_type === 'audio') || !Number.isFinite(duration) || duration <= 0) throw new Error('音乐内容无效');
    let archive = { vodId: '', categoryId: 0, status: 'local' };
    if (process.env.EVENT_MUSIC_VOD_ENABLED !== 'false' && process.env.ALIYUN_ACCESS_KEY_ID && process.env.ALIYUN_ACCESS_KEY_SECRET) {
      try { archive = await archiveEventAudio(filePath, fileName, eventId, eventName); }
      catch (error) { console.error('赛事音乐VOD归档失败，已保留本地原件', error instanceof Error ? error.message : 'VOD上传失败'); }
    }
    return { fileName, filePath, fileUrl: path.posix.join('/uploads/event-music', ...parts, fileName), fileSize: file.size, duration, ...archive };
  } catch (error) { await fs.unlink(filePath).catch(() => undefined); throw new Error('音乐文件无法读取，请上传有效的 MP3、WAV、M4A、AAC 或 FLAC 音频'); }
}
export async function discardEventMusic(music: { filePath: string; vodId: string }) {
  await fs.unlink(music.filePath).catch(() => undefined);
  if (music.vodId) await deleteEventAudio(music.vodId).catch(() => undefined);
}
