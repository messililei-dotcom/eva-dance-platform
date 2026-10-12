import { GET as getPlayers } from '../players/route';
import { eventEntrySummary } from '@/lib/event-entry-summary';
import { cleanText, hasAuth, jsonError, unauthorized } from '../_db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Number the entire authorized event before client filtering or pagination. */
export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const incoming = new URL(request.url);
  const id = cleanText(incoming.searchParams.get('competitionId'));
  if (!/^[1-9]\d*$/.test(id)) return jsonError('缺少有效赛事ID');
  const url = new URL('/api/event/players', incoming.origin);
  url.searchParams.set('competitionId', id);
  const response = await getPlayers(new Request(url, { headers: request.headers }));
  if (!response.ok) return response;
  const payload = await response.json();
  if (!payload.success || !Array.isArray(payload.data)) return jsonError('报名汇总加载失败', 502);
  return Response.json({ success: true, data: eventEntrySummary(payload.data) }, { headers: { 'Cache-Control': 'private, no-store' } });
}
