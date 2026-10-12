import { hasAuth, unauthorized, jsonError, readEventBody, withRequestEventDb, toNumber, nowIso } from '../../_db';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
function ids(value: unknown): number[] {
  return Array.isArray(value) ? [...new Set(value.map(Number).filter(id => Number.isSafeInteger(id) && id > 0))] : [];
}
export async function POST(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const body = await readEventBody(request);
  const competitionId = toNumber(body.competitionId), groupId = toNumber(body.groupId);
  const groupIds = ids(body.groupIds), judgeIds = ids(body.judgeIds);
  if (!competitionId || !groupId || !groupIds.length || !judgeIds.length || groupIds.length > 500 || judgeIds.length > 500 || groupIds.includes(groupId)) return jsonError('请选择来源组别、评委和其他目标组别',400);
  return withRequestEventDb(request, db => {
    const groups = [groupId,...groupIds];
    const valid = db.prepare(`SELECT COUNT(*) AS count FROM event_groups WHERE competition_id=? AND id IN (${groups.map(()=>'?').join(',')})`).get(competitionId,...groups);
    if (valid.count !== groups.length) return jsonError('部分组别不存在或不属于当前赛事',404);
    const source = db.prepare(`SELECT * FROM event_group_judges WHERE competition_id=? AND group_id=? AND judge_id IN (${judgeIds.map(()=>'?').join(',')})`).all(competitionId,groupId,...judgeIds);
    if (source.length !== judgeIds.length) return jsonError('部分评委已不在来源组别，请刷新后重试',409);
    const insert = db.prepare(`INSERT INTO event_group_judges(competition_id,group_id,judge_id,role,weight,auth_enabled,status,updated_at)
      VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(group_id,judge_id) DO NOTHING`);
    const copied = db.transaction(() => {
      let count = 0;
      for (const target of groupIds) for (const row of source) count += insert.run(competitionId,target,row.judge_id,row.role,row.weight,row.auth_enabled,row.status,nowIso()).changes;
      return count;
    })();
    return Response.json({ success:true,data:{copied,skipped:groupIds.length*judgeIds.length-copied} });
  });
}
