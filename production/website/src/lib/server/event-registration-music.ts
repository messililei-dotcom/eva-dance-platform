import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

const ROOT = process.env.EVENT_MUSIC_DRAFT_ROOT || '/www/wwwroot/dongfangwuquan/event-registration-music-drafts';
export const MUSIC_DRAFT_TTL = 24 * 60 * 60 * 1000;
export const MAX_MUSIC_FILE_SIZE = 10 * 1024 * 1024;
const EXTENSIONS = new Set(['.mp3', '.wav', '.m4a', '.aac', '.flac']);
type MusicDraft = { uploadId: string; memberId: number; competitionId: number; fileName: string; fileSize: number; type: string; expiresAt: number };

export function validateRegistrationMusic(file: File) {
  if (!file.size) throw new Error('请选择需要上传的音乐文件');
  if (file.size > MAX_MUSIC_FILE_SIZE) throw new Error('音乐文件不能超过 10MB');
  if (!EXTENSIONS.has(path.extname(file.name).toLowerCase())) throw new Error('请上传 MP3、WAV、M4A、AAC 或 FLAC 音乐文件');
}

async function cleanupExpiredDrafts() {
  const entries = await fs.readdir(ROOT);
  for (const name of entries.filter(name => /^[a-f0-9-]{36}\.json$/.test(name))) {
    const metadataPath = path.join(ROOT, name);
    const draft = JSON.parse(await fs.readFile(metadataPath, 'utf8')) as MusicDraft;
    if (draft.expiresAt <= Date.now()) {
      await fs.unlink(path.join(ROOT, name.replace(/\.json$/, '.audio'))).catch(() => undefined);
      await fs.unlink(metadataPath).catch(() => undefined);
    }
  }
}

export async function saveRegistrationMusic(file: File, memberId: number, competitionId: number) {
  validateRegistrationMusic(file);
  await fs.mkdir(ROOT, { recursive: true, mode: 0o700 });
  await cleanupExpiredDrafts();
  const uploadId = randomUUID();
  const draft: MusicDraft = { uploadId, memberId, competitionId, fileName: path.basename(file.name, path.extname(file.name)).slice(0, 180) + path.extname(file.name).toLowerCase(), fileSize: file.size, type: file.type, expiresAt: Date.now() + MUSIC_DRAFT_TTL };
  const audioPath = path.join(ROOT, uploadId + '.audio');
  try {
    await fs.writeFile(audioPath, Buffer.from(await file.arrayBuffer()), { mode: 0o600, flag: 'wx' });
    await fs.writeFile(path.join(ROOT, uploadId + '.json'), JSON.stringify(draft), { mode: 0o600, flag: 'wx' });
    return { uploadId, fileName: draft.fileName, fileSize: draft.fileSize, expiresAt: draft.expiresAt };
  } catch (error) {
    await fs.unlink(audioPath).catch(() => undefined);
    throw error;
  }
}

export async function readRegistrationMusic(uploadId: string, memberId: number, competitionId: number) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(uploadId)) throw new Error('音乐上传记录无效，请重新上传');
  let draft: MusicDraft;
  try { draft = JSON.parse(await fs.readFile(path.join(ROOT, uploadId + '.json'), 'utf8')); }
  catch { throw new Error('音乐上传记录已失效，请重新上传'); }
  if (draft.memberId !== memberId || draft.competitionId !== competitionId) throw new Error('音乐上传记录无效，请重新上传');
  if (draft.expiresAt <= Date.now()) throw new Error('音乐上传记录已过期，请重新上传');
  let bytes: Buffer;
  try { bytes = await fs.readFile(path.join(ROOT, uploadId + '.audio')); }
  catch { throw new Error('音乐文件已失效，请重新上传'); }
  if (bytes.length !== draft.fileSize) throw new Error('音乐文件不完整，请重新上传');
  return new File([new Uint8Array(bytes)], draft.fileName, { type: draft.type });
}

export async function removeRegistrationMusic(uploadId: string) {
  if (!/^[a-f0-9-]{36}$/.test(uploadId)) return;
  await fs.unlink(path.join(ROOT, uploadId + '.audio')).catch(() => undefined);
  await fs.unlink(path.join(ROOT, uploadId + '.json')).catch(() => undefined);
}
