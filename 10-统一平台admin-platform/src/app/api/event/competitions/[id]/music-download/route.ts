import { eventMusicExtension, eventMusicFilename, filenamePart, legacyEventMusicUrl, limitBytes } from '@/lib/server/event-music-filename';
import { resolveEventMusicFile } from '@/lib/server/event-music-path';
import fs from 'node:fs';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { Zip, ZipPassThrough } from 'fflate';
import { hasAuth, unauthorized, withRequestEventDb, jsonError } from '../../../_db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type MusicEntry = {
  name: string; group_name: string; title: string; sequence_no: number; file_url: string;
};

type ArchiveFile = { name: string; size: number; source: string | URL };
type MusicSnapshot = { name: string; entries: MusicEntry[] };

const chunkSize = 64 * 1024;
const emptyChunk = new Uint8Array(0);
const legacyFetchOptions: RequestInit = { cache: 'no-store', redirect: 'error', headers: { 'Accept-Encoding': 'identity' } };

async function inspectMusic(entry: MusicEntry, signal: AbortSignal): Promise<ArchiveFile> {
  signal.throwIfAborted();
  const url = legacyEventMusicUrl(entry.file_url);
  let source: string | URL;
  let size: number;
  try {
    if (url) {
      source = url;
      const head = await fetch(url, {
        ...legacyFetchOptions, method: 'HEAD', signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
      });
      if (!head.ok) throw new Error('旧音乐不可读');
      size = Number(head.headers.get('content-length'));
    } else {
      source = resolveEventMusicFile(entry.file_url);
      fs.accessSync(source, fs.constants.R_OK);
      size = fs.statSync(source).size;
    }
    if (!Number.isSafeInteger(size) || size <= 0) throw new Error('音乐大小无效');
  } catch {
    throw new Error(entry.name + '的音乐读取失败，请刷新后重试');
  }
  const extension = eventMusicExtension(entry.file_url, url);
  if (!extension) {
    throw new Error(entry.name + '的音乐格式无法识别，请核对后重试');
  }
  return { name: eventMusicFilename(entry.group_name, entry.sequence_no, entry.name, entry.title, extension), source, size };
}

async function openMusic(source: ArchiveFile['source'], signal: AbortSignal) {
  if (typeof source === 'string') return fs.createReadStream(source, { highWaterMark: chunkSize, signal });
  const response = await fetch(source, { ...legacyFetchOptions, signal });
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    throw new Error('旧音乐读取失败，请重试');
  }
  return Readable.fromWeb(response.body as NodeReadableStream<Uint8Array>, { signal, highWaterMark: chunkSize });
}

async function* streamArchive(files: ArchiveFile[], signal: AbortSignal) {
  const chunks: Uint8Array[] = [];
  const zip = new Zip((error, bytes) => {
    if (error) throw error;
    if (bytes.length) chunks.push(bytes);
  });
  try {
    for (const file of files) {
      signal.throwIfAborted();
      const entry = new ZipPassThrough(file.name);
      zip.add(entry);
      for await (const bytes of await openMusic(file.source, signal)) {
        if (entry.size + bytes.length > file.size) throw new Error('音乐文件在下载时发生变化');
        entry.push(bytes);
        yield* chunks.splice(0);
      }
      if (entry.size !== file.size) throw new Error('音乐文件在下载时发生变化');
      entry.push(emptyChunk, true);
      yield* chunks.splice(0);
    }
    signal.throwIfAborted();
    zip.end();
    yield* chunks.splice(0);
  } finally {
    zip.terminate();
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasAuth(request)) return unauthorized();
  const { id } = await params;
  if (!/^[1-9][0-9]*$/.test(id)) return jsonError('赛事不存在', 404);
  const snapshot: MusicSnapshot | Response = withRequestEventDb(request, db => {
    const competition = db.prepare('SELECT id,name FROM event_competitions WHERE id=?').get(id);
    if (!competition) return jsonError('赛事不存在或无权访问', 404);
    const entries: MusicEntry[] = db.prepare(
      "SELECT p.name,g.name AS group_name,ep.title,ep.sequence_no,mf.file_url " +
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

  try {
    if (snapshot.entries.length >= 0xffff) throw new Error('音乐包超过 ZIP 支持的大小');
    const files: ArchiveFile[] = [];
    // Keep legacy OSS metadata requests bounded and preserve performance order.
    for (let offset = 0; offset < snapshot.entries.length; offset += 12) {
      const entries = snapshot.entries.slice(offset, offset + 12);
      files.push(...await Promise.all(entries.map(entry => inspectMusic(entry, request.signal))));
    }
    // fflate's uncompressed ZIP entries have a local header (30), a data
    // descriptor (16), a central-directory header (46) and the name twice.
    const size = files.reduce((total, file) => total + file.size + 30 + 16 + 46 + 2 * Buffer.byteLength(file.name), 22);
    if (size >= 0xffffffff) {
      throw new Error('音乐包超过 ZIP 支持的大小');
    }
    const downloadName = limitBytes(filenamePart(snapshot.name, '赛事'), 180) + '-全部音乐.zip';
    if (new URL(request.url).searchParams.get('check') === '1') {
      return Response.json({ success: true, data: { fileName: downloadName, count: files.length, size } }, {
        headers: { 'Cache-Control': 'private, no-store' },
      });
    }
    const stream = Readable.from(streamArchive(files, request.signal), { objectMode: false, highWaterMark: chunkSize });
    const body = Readable.toWeb(stream, { strategy: { highWaterMark: chunkSize, size: chunk => chunk.byteLength } });
    return new Response(body as ReadableStream<Uint8Array>, { headers: {
      'Content-Type': 'application/zip',
      'Content-Length': String(size),
      'Content-Disposition': "attachment; filename=\"event-music.zip\"; filename*=UTF-8''" + encodeURIComponent(downloadName),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Accel-Buffering': 'no',
    } });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : '音乐打包失败，请重试', 400);
  }
}
