import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolveEventMusicFile } from '@/lib/server/event-music-path';
import writeExcelFile from 'write-excel-file/node';
import type { SheetData, Sheet } from 'write-excel-file/node';
import { hasAuth, unauthorized, readEventBody, withRequestEventDb, jsonError } from '../../_db';
import { eventPlayerExport, EventExportError, formatEventMusicDuration } from '@/lib/server/event-player-export';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;
const probe = promisify(execFile);

export async function POST(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const body = await readEventBody(request);
  try {
    const result = withRequestEventDb(request, db => eventPlayerExport(db, Number(body.competitionId), body.ids, 'https://admin.swod.com.cn'));
    if (result instanceof Response) return result;
    const durations = new Map<string, string>();
    for (const entry of result.missingMusic) {
      if (request.signal.aborted) return jsonError('导出已取消', 400);
      let duration = durations.get(entry.fileUrl);
      if (duration === undefined) {
        try {
          const file = resolveEventMusicFile(entry.fileUrl);
          const { stdout } = await probe(process.env.EVENT_FFPROBE_PATH || '/usr/bin/ffprobe',
            ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=duration:format=duration', '-of', 'json', file],
            { timeout: 5000, maxBuffer: 64 * 1024, signal: request.signal });
          const metadata = JSON.parse(stdout);
          duration = metadata.streams?.length
            ? formatEventMusicDuration(metadata.streams[0].duration) || formatEventMusicDuration(metadata.format?.duration) : '';
        } catch {
          duration = '';
        }
        durations.set(entry.fileUrl, duration);
      }
      result.music[entry.index]['音乐时长'] = duration || '无法读取';
      if (entry.registration) entry.registration['音乐时长'] = duration || '无法读取';
    }
    const sheet = (name: string, rows: Record<string, unknown>[], fallback: string[]): Sheet<Buffer> => {
      const headers = rows.length ? Object.keys(rows[0]) : fallback;
      const data: SheetData = [headers.map(value => ({ value, type: String, fontWeight: 'bold', backgroundColor: '#F3F4F6', color: '#374151', wrap: true })),
        ...rows.map(row => headers.map(key => typeof row[key] === 'number'
          ? { value: Number(row[key]), type: Number, wrap: true }
          : { value: String(row[key] ?? ''), type: String, wrap: true }))];
      return { sheet: name, data, stickyRowsCount: 1, columns: headers.map(h => ({ width: h.includes('入口') ? 55 : h.includes('名称') || h.includes('备注') || h.includes('文件名') ? 28 : 18 })) };
    };
    const buffer = await writeExcelFile([
      sheet('报名明细', result.registrations, ['报名ID', '选手姓名']),
      sheet('音乐明细', result.music, ['报名ID', '报名编号', '选手编号', '选手姓名', '组别名称', '音乐文件ID', '是否当前音乐', '音乐文件名', '音乐时长', '音乐大小（字节）', '上传时间', '审核状态', '审核备注', '审核时间', '音乐入口（需登录）']),
      sheet('缴费明细', result.payments, ['报名ID', '报名编号', '选手编号', '选手姓名', '组别名称', '收退款记录ID', '类型', '金额（元）', '方式', '收退款时间', '备注', '创建时间']),
    ]).toBuffer();
    const filename = `${result.name.replace(/[\\/:*?"<>|\r\n]/g, '_')}-报名表格.xlsx`;
    return new Response(new Uint8Array(buffer), { headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="event-registrations.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
    } });
  } catch (error) {
    if (error instanceof EventExportError) return jsonError(error.message, error.status);
    throw error;
  }
}
