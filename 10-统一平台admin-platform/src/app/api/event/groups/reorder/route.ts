import { hasAuth, jsonError, nowIso, readEventBody, unauthorized, withRequestEventDb } from '../../_db';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const body = await readEventBody(request);
  if (!body || typeof body !== 'object') return jsonError('请提供赛事及完整的组别排序');
  const competitionId = Number(body.competitionId);
  const validIds = (value: unknown): value is number[] => Array.isArray(value) && value.length > 0 && value.every(id => Number.isSafeInteger(id) && id > 0) && new Set(value).size === value.length;
  if (!Number.isSafeInteger(competitionId) || competitionId < 1 || !validIds(body.ids) || !validIds(body.previousIds)) return jsonError('请提供赛事及完整的组别排序');
  return withRequestEventDb(request, db => db.transaction(() => {
    if (!db.prepare('SELECT id FROM event_competitions WHERE id=?').get(competitionId)) return jsonError('赛事不存在', 404);
    const current = db.prepare('SELECT id FROM event_groups WHERE competition_id=? ORDER BY sort_order,id').all(competitionId) as { id: number }[];
    const ids = current.map(row => Number(row.id));
    if (ids.length !== body.ids.length || body.ids.some((id: number) => !ids.includes(id))) return jsonError('组别列表已变化，请刷新后重试', 409);
    if (ids.join(',') !== body.previousIds.join(',')) return jsonError('排序已被其他操作修改，请刷新后重试', 409);
    if (ids.join(',') === body.ids.join(',')) return Response.json({ success: true, data: { ids, changed: false } });
    const update = db.prepare('UPDATE event_groups SET sort_order=?,updated_at=? WHERE id=? AND competition_id=?');
    const stamp = nowIso();
    body.ids.forEach((id: number, index: number) => update.run(index + 1, stamp, id, competitionId));
    return Response.json({ success: true, data: { ids: body.ids, changed: true } });
  }).immediate());
}
