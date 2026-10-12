import { randomInt } from 'node:crypto';
import { hasAuth, jsonError, nowIso, readEventBody, unauthorized, withRequestEventDb } from '../../_db';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const body = await readEventBody(request);
  const competitionId = Number(body?.competitionId);
  if (!Number.isSafeInteger(competitionId) || competitionId < 1) return jsonError('缺少有效赛事ID');
  return withRequestEventDb(request, db => db.transaction(() => {
    if (!db.prepare('SELECT id FROM event_competitions WHERE id=?').get(competitionId)) return jsonError('赛事不存在', 404);
    const rows = db.prepare(`SELECT p.id,p.name,p.group_id FROM event_players p JOIN event_groups g ON g.id=p.group_id AND g.competition_id=p.competition_id WHERE p.competition_id=? AND COALESCE(p.status,'pending')!='cancelled' AND COALESCE(p.audit_status,'pending')!='rejected' ORDER BY g.sort_order,g.id,p.id`).all(competitionId) as {id:number;name:string;group_id:number}[];
    if (!rows.length) return jsonError('赛事没有可编排的报名');
    const groups = new Map<number, typeof rows>();
    rows.forEach(row => groups.set(row.group_id, [...(groups.get(row.group_id) || []), row]));
    const find = db.prepare('SELECT id FROM event_performances WHERE competition_id=? AND player_id=? ORDER BY id DESC LIMIT 1');
    const update = db.prepare('UPDATE event_performances SET sequence_no=?,updated_at=? WHERE id=? AND competition_id=?');
    const insert = db.prepare("INSERT INTO event_performances (competition_id,group_id,player_id,title,sequence_no,status,updated_at) VALUES (?,?,?,?,?,'pending',?)");
    const stamp = nowIso();
    groups.forEach((players, groupId) => {
      for (let i=players.length-1;i>0;i--) { const j=randomInt(i+1); [players[i],players[j]]=[players[j],players[i]]; }
      players.forEach((player,index) => {
        const performance = find.get(competitionId,player.id) as {id:number}|undefined;
        if (performance) update.run(index+1,stamp,performance.id,competitionId);
        else insert.run(competitionId,groupId,player.id,player.name,index+1,stamp);
      });
    });
    return Response.json({success:true,data:{updated:rows.length,groups:groups.size}});
  }).immediate());
}
