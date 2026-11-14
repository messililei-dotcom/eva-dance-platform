import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { Zip, ZipPassThrough } from 'fflate';
import { hasAuth, unauthorized, withRequestEventDb, jsonError } from '../../../_db';
import { GET as readMusic } from '../../../music/[id]/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type MusicEntry = {
  id: number; name: string; group_name: string; title: string;
  sequence_no: number; music_id: number; file_name: string; file_url: string;
};

function filenamePart(value: string, fallback: string) {
  return String(value || '').normalize('NFC').replace(/[\\/:*?"<>|\x00-\x1f\x7f]/g, '_')
    .replace(/^\.+/, '_').replace(/[. ]+$/, '').trim() || fallback;
}

function limitBytes(value: string, limit: number) {
  let result = '';
  for (const character of value) {
    if (Buffer.byteLength(result + character) > limit) break;
    result += character;
  }
  return result;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasAuth(request)) return unauthorized();
  const { id } = await params;
  if (!/^[1-9][0-9]*$/.test(id)) return jsonError('赛事不存在', 404);
  const snapshot = withRequestEventDb(request, db => {
    const competition = db.prepare('SELECT id,name FROM event_competitions WHERE id=?').get(id);
    if (!competition) return jsonError('赛事不存在或无权访问', 404);
    const entries: MusicEntry[] = db.prepare(
      "SELECT p.id,p.name,g.name AS group_name,ep.title,ep.sequence_no,mf.id AS music_id,mf.file_name,mf.file_url " +
      "FROM event_players p JOIN event_groups g ON g.id=p.group_id AND g.competition_id=p.competition_id " +
      "JOIN event_performances ep ON ep.id=(SELECT id FROM event_performances WHERE competition_id=p.competition_id AND player_id=p.id ORDER BY id DESC LIMIT 1) " +
      "JOIN event_music_files mf ON mf.id=ep.music_file_id AND mf.competition_id=p.competition_id " +
      "WHERE p.competition_id=? AND p.status NOT IN ('cancelled','withdrawn') AND p.audit_status<>'rejected' " +
      "ORDER BY g.sort_order,g.id,CASE WHEN ep.sequence_no>0 THEN 0 ELSE 1 END,CASE WHEN ep.sequence_no>0 THEN ep.sequence_no ELSE 0 END,p.id"
    ).all(id);
    return { name: String(competition.name), entries };
  });
  if (snapshot instanceof Response) return snapshot;
  if (!snapshot.entries.length) return jsonError('当前赛事暂无已上传的音乐', 404);

  let directory: string | undefined;
  let fd: number | undefined;
  try {
    directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'swod-music-zip-'));
    const archive = path.join(directory, 'music.zip');
    fd = fs.openSync(archive, 'wx', 0o600);
    let archiveError: Error | null = null;
    let finished = false;
    let size = 0;
    const zip = new Zip((error, bytes, final) => {
      if (error) { archiveError = error; return; }
      size += bytes.length;
      if (size >= 0xffffffff) { archiveError = new Error('音乐包超过 ZIP 支持的大小'); return; }
      let offset = 0;
      while (offset < bytes.length) {
        const written = fs.writeSync(fd!, bytes, offset, bytes.length - offset);
        if (!written) throw new Error('音乐包写入失败，请重试');
        offset += written;
      }
      if (final) finished = true;
    });
    for (const [index, entry] of snapshot.entries.entries()) {
      if (request.signal.aborted) throw new Error('下载已取消');
      const url = new URL('/api/event/music/' + entry.music_id, request.url);
      const headers = new Headers();
      for (const name of ['authorization', 'cookie']) {
        const value = request.headers.get(name);
        if (value) headers.set(name, value);
      }
      const response = await readMusic(new Request(url, { headers, signal: request.signal }), { params: Promise.resolve({ id: String(entry.music_id) }) });
      if (!response.ok) throw new Error(entry.name + '的音乐读取失败，请刷新后重试');
      const extension = path.extname(entry.file_url).toLowerCase();
      if (!['.mp3', '.wav', '.m4a', '.aac', '.flac'].includes(extension)) {
        throw new Error(entry.name + '的音乐格式无法识别，请核对后重试');
      }
      const prefix = '节目' + String(index + 1).padStart(3, '0');
      const sequence = entry.sequence_no > 0 ? String(entry.sequence_no) : '未排序';
      const basename = [prefix, limitBytes(filenamePart(entry.group_name, '未分组'), 80), sequence,
        limitBytes(filenamePart(entry.name, '未填写姓名'), 48), limitBytes(filenamePart(entry.title, '未填写节目名称'), 70)].join('-');
      const file = new ZipPassThrough(limitBytes(basename, 230) + extension);
      zip.add(file);
      file.push(new Uint8Array(await response.arrayBuffer()), true);
      if (archiveError) throw archiveError;
    }
    zip.end();
    if (archiveError) throw archiveError;
    if (!finished) throw new Error('音乐打包未完成，请重试');
    fs.closeSync(fd);
    fd = undefined;
    const cleanupRoot = directory;
    const stream = fs.createReadStream(archive);
    stream.once('close', () => { void fs.promises.rm(cleanupRoot, { recursive: true, force: true }); });
    const downloadName = limitBytes(filenamePart(snapshot.name, '赛事'), 180) + '-全部音乐.zip';
    return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, { headers: {
      'Content-Type': 'application/zip',
      'Content-Length': String(size),
      'Content-Disposition': "attachment; filename=\"event-music.zip\"; filename*=UTF-8''" + encodeURIComponent(downloadName),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    } });
  } catch (error) {
    if (fd !== undefined) fs.closeSync(fd);
    if (directory) await fs.promises.rm(directory, { recursive: true, force: true });
    return jsonError(error instanceof Error ? error.message : '音乐打包失败，请重试', 400);
  }
}
