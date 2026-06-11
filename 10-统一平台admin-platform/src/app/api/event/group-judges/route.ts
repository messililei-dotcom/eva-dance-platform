import { cleanText, hasAuth, jsonError, nowIso, toNumber, unauthorized, withEventDb } from '../_db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!hasAuth(request)) return unauthorized();

  const body = await request.json().catch(() => ({}));
  const competitionId = toNumber(body.competitionId ?? body.competition_id);
  const groupId = toNumber(body.groupId ?? body.group_id);
  const judgeId = toNumber(body.judgeId ?? body.judge_id);
  if (!competitionId || !groupId || !judgeId) return jsonError('缺少赛事、组别或评委ID');

  return withEventDb((db) => {
    db.prepare(`
      INSERT INTO event_group_judges (
        competition_id, group_id, judge_id, role, weight, auth_enabled, status, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(group_id, judge_id) DO UPDATE SET
        role = excluded.role,
        weight = excluded.weight,
        auth_enabled = excluded.auth_enabled,
        status = excluded.status,
        updated_at = excluded.updated_at
    `).run(
      competitionId,
      groupId,
      judgeId,
      cleanText(body.role, 'judge'),
      toNumber(body.weight, 1),
      body.authEnabled ?? body.auth_enabled ?? true ? 1 : 0,
      cleanText(body.status, 'active'),
      nowIso(),
    );
    return Response.json({ success: true });
  });
}
