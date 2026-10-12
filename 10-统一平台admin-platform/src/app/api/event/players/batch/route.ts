import { cleanText, readEventBody, hasAuth, jsonError, nowIso, toNumber, unauthorized, withRequestEventDb } from '../../_db';
import { syncEventPlayerToMember } from '@/lib/server/event-member-sync';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function normalizeIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => toNumber(item)).filter(Boolean))].slice(0, 500);
}

export async function POST(request: Request) {
  if (!hasAuth(request)) return unauthorized();

  const body = await readEventBody(request);
  const competitionId = toNumber(body.competitionId ?? body.competition_id);
  const groupId = toNumber(body.groupId ?? body.group_id);
  const rows = Array.isArray(body.rows) ? body.rows.slice(0, 500) : [];
  if (!competitionId || !groupId) return jsonError('缺少赛事或组别ID');
  if (!rows.length) return jsonError('没有可新增的选手数据');

  return withRequestEventDb(request, (db) => {
    const group = db.prepare('SELECT id,registration_fee FROM event_groups WHERE id = ? AND competition_id = ?').get(groupId, competitionId);
    if (!group) return jsonError('组别不存在或不属于当前赛事', 404);

    const errors: Array<{ row: number; message: string }> = [];
    const createdIds: number[] = [];
    const insert = db.prepare(`
      INSERT INTO event_players (
        competition_id, group_id, member_id, order_id, player_no, name, phone,
        gender, birthday, organization, teacher, status, audit_status,
        paid_status, score_status, remark, updated_at, registration_fee
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.transaction(() => {
      rows.forEach((row: any, index: number) => {
        const name = cleanText(row?.name ?? row?.姓名);
        if (!name) {
          errors.push({ row: index + 1, message: '选手姓名不能为空' });
          return;
        }
        const phone = cleanText(row?.phone ?? row?.手机号);
        const member = syncEventPlayerToMember(db, {
          memberId: row?.memberId ?? row?.member_id,
          name,
          phone,
          gender: row?.gender ?? row?.性别,
          birthday: row?.birthday ?? row?.生日,
        });
        const result = insert.run(
          competitionId,
          groupId,
          member.memberId,
          toNumber(row?.orderId ?? row?.order_id),
          '',
          name,
          phone,
          cleanText(row?.gender ?? row?.性别),
          cleanText(row?.birthday ?? row?.生日),
          cleanText(row?.organization ?? row?.机构),
          cleanText(row?.teacher ?? row?.课程顾问),
          cleanText(row?.status, 'approved'),
          'approved',
          'unpaid',
          cleanText(row?.scoreStatus ?? row?.score_status, 'not_started'),
          cleanText(row?.remark ?? row?.备注),
          nowIso(),
          Number(group.registration_fee || 0),
        );
        createdIds.push(Number(result.lastInsertRowid));
      });
    })();

    return Response.json({ success: true, data: { created: createdIds.length, createdIds, errors } });
  });
}

export async function PATCH(request: Request) {
  if (!hasAuth(request)) return unauthorized();

  const body = await readEventBody(request);
  const competitionId = toNumber(body.competitionId ?? body.competition_id);
  const groupId = toNumber(body.groupId ?? body.group_id);
  const action = cleanText(body.action);

  if (action === 'randomize_sequence') {
    if (!competitionId || !groupId) return jsonError('缺少赛事或组别ID');

    return withRequestEventDb(request, (db) => {
      const group = db.prepare('SELECT id,registration_fee FROM event_groups WHERE id = ? AND competition_id = ?').get(groupId, competitionId);
      if (!group) return jsonError('组别不存在或不属于当前赛事', 404);

      const players = db.prepare(`
        SELECT id, name
        FROM event_players
        WHERE competition_id = ?
          AND group_id = ?
          AND COALESCE(status, 'pending') != 'cancelled'
          AND COALESCE(audit_status, 'pending') != 'rejected'
        ORDER BY id ASC
      `).all(competitionId, groupId) as Array<{ id: number; name: string }>;
      if (!players.length) return jsonError('当前组别没有可编排的选手');

      for (let index = players.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        [players[index], players[randomIndex]] = [players[randomIndex], players[index]];
      }

      const now = nowIso();
      const findPerformance = db.prepare(`
        SELECT id FROM event_performances
        WHERE player_id = ?
        ORDER BY id DESC
        LIMIT 1
      `);
      const updatePerformance = db.prepare(`
        UPDATE event_performances
        SET competition_id = ?, group_id = ?, sequence_no = ?, updated_at = ?
        WHERE id = ?
      `);
      const insertPerformance = db.prepare(`
        INSERT INTO event_performances (
          competition_id, group_id, player_id, title, sequence_no, status, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'pending', ?)
      `);

      const assignments = db.transaction(() => players.map((player, index) => {
        const sequenceNo = index + 1;
        const performance = findPerformance.get(player.id) as { id: number } | undefined;
        if (performance) {
          updatePerformance.run(competitionId, groupId, sequenceNo, now, performance.id);
        } else {
          insertPerformance.run(competitionId, groupId, player.id, player.name, sequenceNo, now);
        }
        return { playerId: player.id, name: player.name, sequenceNo };
      }))();

      return Response.json({ success: true, data: { updated: assignments.length, assignments } });
    });
  }

  const ids = normalizeIds(body.ids);
  if (body.patch?.paidStatus !== undefined || body.patch?.paid_status !== undefined) return jsonError('请逐项使用登记缴费功能');
  const patch = body.patch && typeof body.patch === 'object' ? body.patch : {};
  if (!competitionId || !groupId || !ids.length) return jsonError('缺少赛事、组别或选手ID');

  const fieldMap: Array<[string, string, (value: unknown) => unknown]> = [
    ['paidStatus', 'paid_status', (value) => cleanText(value)],
    ['scoreStatus', 'score_status', (value) => cleanText(value)],
    ['status', 'status', (value) => cleanText(value)],
    ['organization', 'organization', (value) => cleanText(value)],
    ['teacher', 'teacher', (value) => cleanText(value)],
    ['remark', 'remark', (value) => cleanText(value)],
  ];
  const sets: string[] = [];
  const values: unknown[] = [];
  fieldMap.forEach(([input, column, normalize]) => {
    if (Object.prototype.hasOwnProperty.call(patch, input) && patch[input] !== undefined) {
      sets.push(`${column} = ?`);
      values.push(normalize(patch[input]));
    }
  });
  if (!sets.length) return jsonError('请选择至少一项需要修改的内容');

  return withRequestEventDb(request, (db) => {
    const placeholders = ids.map(() => '?').join(', ');
    sets.push('updated_at = ?');
    values.push(nowIso(), competitionId, groupId, ...ids);
    const result = db.prepare(`
      UPDATE event_players
      SET ${sets.join(', ')}
      WHERE competition_id = ? AND group_id = ? AND id IN (${placeholders})
    `).run(...values);
    return Response.json({ success: true, data: { updated: result.changes } });
  });
}

export async function DELETE(request: Request) {
  if (!hasAuth(request)) return unauthorized();

  const body = await readEventBody(request);
  const competitionId = toNumber(body.competitionId ?? body.competition_id);
  const groupId = toNumber(body.groupId ?? body.group_id);
  const ids = normalizeIds(body.ids);
  if (!competitionId || !groupId || !ids.length) return jsonError('缺少赛事、组别或选手ID');

  return withRequestEventDb(request, (db) => {
    const placeholders = ids.map(() => '?').join(', ');
    if (db.prepare(`SELECT id FROM event_registration_payments WHERE player_id IN (${placeholders}) LIMIT 1`).get(...ids)) return jsonError('报名已有缴费记录，请保留记录并使用取消报名状态');
    const result = db.prepare(`
      DELETE FROM event_players
      WHERE competition_id = ? AND group_id = ? AND id IN (${placeholders})
    `).run(competitionId, groupId, ...ids);
    return Response.json({ success: true, data: { deleted: result.changes } });
  });
}
