import { hasAuth, jsonError, nowIso, readEventBody, unauthorized, withRequestEventDb } from '../../_db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function validIds(value: unknown): value is number[] {
  return Array.isArray(value) && value.length > 0 && new Set(value).size === value.length &&
    value.every(id => Number.isSafeInteger(id) && id > 0);
}

export async function POST(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const { competitionId, groupId, ids, previousIds } = await readEventBody(request) || {};
  if (!Number.isSafeInteger(competitionId) || competitionId < 1 ||
    !Number.isSafeInteger(groupId) || groupId < 1 || !validIds(ids) || !validIds(previousIds)) {
    return jsonError('请提交完整的组内出场顺序');
  }

  return withRequestEventDb(request, db => db.transaction(() => {
    if (!db.prepare('SELECT id FROM event_groups WHERE id=? AND competition_id=?').get(groupId, competitionId)) {
      return jsonError('组别不存在', 404);
    }
    const rows: { id: number; name: string; performanceId: number | null }[] = db.prepare(`
      SELECT p.id, p.name, ep.id AS performanceId
      FROM event_players p
      LEFT JOIN event_performances ep ON ep.id = (
        SELECT id FROM event_performances WHERE competition_id=p.competition_id AND player_id=p.id ORDER BY id DESC LIMIT 1
      )
      WHERE p.competition_id=? AND p.group_id=? AND p.status NOT IN ('cancelled','withdrawn') AND p.audit_status<>'rejected'
      ORDER BY CASE WHEN ep.sequence_no>0 THEN 0 ELSE 1 END,
        CASE WHEN ep.sequence_no>0 THEN ep.sequence_no ELSE 0 END, p.id
    `).all(competitionId, groupId);
    const current = rows.map(row => row.id);
    const byId = new Map(rows.map(row => [row.id, row]));
    if (ids.length !== current.length || ids.some(id => !byId.has(id))) return jsonError('组内报名已变化，请刷新后重试', 409);
    if (ids.join(',') === current.join(',')) return Response.json({ success: true });
    if (previousIds.join(',') !== current.join(',')) return jsonError('出场顺序已更新，请刷新后重试', 409);

    const update = db.prepare('UPDATE event_performances SET sequence_no=?,updated_at=? WHERE id=? AND competition_id=?');
    const insert = db.prepare(`
      INSERT INTO event_performances(competition_id,group_id,player_id,title,sequence_no,status,updated_at)
      VALUES(?,?,?,?,?,'pending',?)
    `);
    const stamp = nowIso();
    ids.forEach((id, index) => {
      const row = byId.get(id)!;
      if (row.performanceId) update.run(index + 1, stamp, row.performanceId, competitionId);
      else insert.run(competitionId, groupId, id, row.name, index + 1, stamp);
    });
    return Response.json({ success: true });
  }).immediate());
}
