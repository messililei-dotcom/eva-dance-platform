import { hasAuth, unauthorized, readEventBody, toNumber, jsonError, withRequestEventDb } from '../../_db';
import { importEventEntries } from '@/lib/server/event-entry-import';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const body = await readEventBody(request);
  const competitionId = toNumber(body.competitionId);
  const rows = body.rows;
  if (!competitionId) return jsonError('缺少赛事ID');
  if (!Array.isArray(rows) || !rows.length || rows.length > 2000 || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row))) return jsonError('请提供 1～2000 行有效数据');
  return withRequestEventDb(request, (db) => {
    if (!db.prepare('SELECT id FROM event_competitions WHERE id=?').get(competitionId)) return jsonError('赛事不存在',404);
    return Response.json({ success:true, data:importEventEntries(db,competitionId,rows,'players') });
  });
}
