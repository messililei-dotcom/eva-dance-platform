import { resolveEventMusicFile } from '@/lib/server/event-music-path';
import fs from 'fs';
import path from 'path';
import { hasAuth, unauthorized, withRequestEventDb, jsonError } from '../../_db';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasAuth(request)) return unauthorized();
  const { id } = await params;
  if (!/^\d+$/.test(id)) return jsonError('音乐不存在', 404);
  return withRequestEventDb(request, db => {
    const music = db.prepare('SELECT * FROM event_music_files WHERE id=?').get(id);
    if (!music) return jsonError('音乐不存在', 404);
    try {
      const file = resolveEventMusicFile(music.file_url);
      const stat = fs.statSync(file); if (!stat.isFile()) return jsonError('音乐不存在', 404);
      const size = stat.size, range = request.headers.get('range'); let start = 0, end = size - 1;
      if (range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (!match || (!match[1] && !match[2])) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
        if (match[1]) { start = Number(match[1]); if (match[2]) end = Math.min(Number(match[2]), end); }
        else start = Math.max(0, size - Number(match[2]));
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
      }
      const bytes = Buffer.alloc(end - start + 1), fd = fs.openSync(file, 'r');
      try { fs.readSync(fd, bytes, 0, bytes.length, start); } finally { fs.closeSync(fd); }
      const types: Record<string,string> = { '.mp3':'audio/mpeg', '.wav':'audio/wav', '.m4a':'audio/mp4', '.aac':'audio/aac', '.flac':'audio/flac' };
      return new Response(new Uint8Array(bytes), { status: range ? 206 : 200, headers: {
        'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Content-Length': String(bytes.length), 'Accept-Ranges':'bytes', 'Cache-Control':'private, no-store',
        'X-Content-Type-Options':'nosniff', 'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(music.file_name)}`,
        ...(range ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}),
      } });
    } catch { return jsonError('音乐文件暂时无法读取', 404); }
  });
}
