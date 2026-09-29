import { cleanText, hasAuth, jsonError, nowIso, toNumber, unauthorized, withEventDb } from '../_db';
import { ensureJudgeForMember } from '@/lib/server/event-judge-member-sync';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function normalizeIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => toNumber(item)).filter(Boolean))].slice(0, 500);
}

export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();

  const url = new URL(request.url);
  const competitionId = toNumber(url.searchParams.get('competitionId') ?? url.searchParams.get('competition_id'));
  const groupId = toNumber(url.searchParams.get('groupId') ?? url.searchParams.get('group_id'));
  if (!groupId) return jsonError('缺少组别ID');

  return withEventDb((db) => {
    const params: unknown[] = [groupId];
    let competitionWhere = '';
    if (competitionId) {
      competitionWhere = 'AND gj.competition_id = ?';
      params.push(competitionId);
    }
    const rows = db.prepare(`
      SELECT
        gj.*,
        j.member_id,
        j.name,
        j.phone,
        j.title,
        j.organization,
        j.auth_enabled AS judge_auth_enabled,
        j.status AS judge_status,
        (SELECT COUNT(*) FROM event_scores s WHERE s.group_id = gj.group_id AND s.judge_id = gj.judge_id) AS score_count
      FROM event_group_judges gj
      INNER JOIN event_judges j ON j.id = gj.judge_id
      WHERE gj.group_id = ? ${competitionWhere}
      ORDER BY gj.role ASC, j.name ASC, j.id ASC
    `).all(...params);
    return Response.json({
      success: true,
      data: rows.map((row: any) => ({
        id: row.id,
        key: String(row.id),
        competitionId: row.competition_id,
        groupId: row.group_id,
        judgeId: row.judge_id,
        memberId: row.member_id || 0,
        name: row.name,
        phone: row.phone || '',
        title: row.title || '',
        organization: row.organization || '',
        role: row.role || 'judge',
        weight: Number(row.weight || 1),
        authEnabled: Boolean(row.auth_enabled),
        judgeAuthEnabled: Boolean(row.judge_auth_enabled),
        status: row.status || 'active',
        judgeStatus: row.judge_status || 'active',
        scoreCount: Number(row.score_count || 0),
      })),
    });
  });
}

export async function POST(request: Request) {
  if (!hasAuth(request)) return unauthorized();

  const body = await request.json().catch(() => ({}));
  const competitionId = toNumber(body.competitionId ?? body.competition_id);
  const groupIds = normalizeIds(body.groupIds ?? body.group_ids);
  const groupId = toNumber(body.groupId ?? body.group_id);
  if (groupId) groupIds.push(groupId);
  const uniqueGroupIds = [...new Set(groupIds)];
  const judgeIds = normalizeIds(body.judgeIds ?? body.judge_ids);
  const memberIds = normalizeIds(body.memberIds ?? body.member_ids);
  const judgeId = toNumber(body.judgeId ?? body.judge_id);
  if (judgeId) judgeIds.push(judgeId);
  const uniqueJudgeIds = [...new Set(judgeIds)];
  if (!competitionId || !uniqueGroupIds.length || (!uniqueJudgeIds.length && !memberIds.length)) return jsonError('缺少赛事、组别或评委ID');

  return withEventDb((db) => {
    const groupPlaceholders = uniqueGroupIds.map(() => '?').join(', ');
    const validGroupCount = Number((db.prepare(`SELECT COUNT(*) AS count FROM event_groups WHERE competition_id = ? AND id IN (${groupPlaceholders})`).get(competitionId, ...uniqueGroupIds) as any)?.count || 0);
    if (validGroupCount !== uniqueGroupIds.length) return jsonError('部分组别不存在或不属于当前赛事', 404);
    const statement = db.prepare(`
      INSERT INTO event_group_judges (
        competition_id, group_id, judge_id, role, weight, auth_enabled, status, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(group_id, judge_id) DO NOTHING
    `);
    let assigned = 0;
    db.transaction(() => {
      memberIds.forEach((memberId) => {
        const judge = ensureJudgeForMember(db, memberId);
        uniqueJudgeIds.push(Number(judge.id));
      });
      const finalJudgeIds = [...new Set(uniqueJudgeIds)];
      finalJudgeIds.forEach((id) => {
        db.prepare("UPDATE event_judges SET auth_enabled=1, status='active', updated_at=? WHERE id=?").run(nowIso(), id);
        uniqueGroupIds.forEach((currentGroupId) => {
          const result = statement.run(
            competitionId,
            currentGroupId,
            id,
            cleanText(body.role, 'judge'),
            toNumber(body.weight, 1),
            Boolean(body.authEnabled ?? body.auth_enabled ?? true) ? 1 : 0,
            cleanText(body.status, 'active'),
            nowIso(),
          );
          assigned += result.changes;
        });
      });
    })();
    const requested = uniqueGroupIds.length * [...new Set(uniqueJudgeIds)].length;
    return Response.json({ success: true, data: { assigned, skipped: requested - assigned } });
  });
}

export async function PATCH(request: Request) {
  if (!hasAuth(request)) return unauthorized();

  const body = await request.json().catch(() => ({}));
  const competitionId = toNumber(body.competitionId ?? body.competition_id);
  const groupId = toNumber(body.groupId ?? body.group_id);
  const judgeIds = normalizeIds(body.judgeIds ?? body.judge_ids);
  const patch = body.patch && typeof body.patch === 'object' ? body.patch : {};
  if (!competitionId || !groupId || !judgeIds.length) return jsonError('缺少赛事、组别或评委ID');

  const sets: string[] = [];
  const values: unknown[] = [];
  if (Object.prototype.hasOwnProperty.call(patch, 'role')) {
    sets.push('role = ?');
    values.push(cleanText(patch.role, 'judge'));
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'weight')) {
    sets.push('weight = ?');
    values.push(toNumber(patch.weight, 1));
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'authEnabled')) {
    sets.push('auth_enabled = ?');
    values.push(patch.authEnabled ? 1 : 0);
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'status')) {
    sets.push('status = ?');
    values.push(cleanText(patch.status, 'active'));
  }
  if (!sets.length) return jsonError('请选择至少一项需要修改的内容');

  return withEventDb((db) => {
    const placeholders = judgeIds.map(() => '?').join(', ');
    sets.push('updated_at = ?');
    values.push(nowIso(), competitionId, groupId, ...judgeIds);
    const result = db.prepare(`
      UPDATE event_group_judges
      SET ${sets.join(', ')}
      WHERE competition_id = ? AND group_id = ? AND judge_id IN (${placeholders})
    `).run(...values);
    return Response.json({ success: true, data: { updated: result.changes } });
  });
}

export async function DELETE(request: Request) {
  if (!hasAuth(request)) return unauthorized();

  const body = await request.json().catch(() => ({}));
  const competitionId = toNumber(body.competitionId ?? body.competition_id);
  const groupId = toNumber(body.groupId ?? body.group_id);
  const judgeIds = normalizeIds(body.judgeIds ?? body.judge_ids);
  if (!competitionId || !groupId || !judgeIds.length) return jsonError('缺少赛事、组别或评委ID');

  return withEventDb((db) => {
    const placeholders = judgeIds.map(() => '?').join(', ');
    const result = db.prepare(`
      DELETE FROM event_group_judges
      WHERE competition_id = ? AND group_id = ? AND judge_id IN (${placeholders})
    `).run(competitionId, groupId, ...judgeIds);
    return Response.json({ success: true, data: { deleted: result.changes } });
  });
}
