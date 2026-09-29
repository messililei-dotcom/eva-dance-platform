import { cleanText, hasAuth, jsonError, nowIso, toNumber, unauthorized, withEventDb } from '../../_db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!hasAuth(request)) return unauthorized();

  const body = await request.json().catch(() => ({}));
  const competitionId = toNumber(body.competitionId ?? body.competition_id);
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (!competitionId) return jsonError('缺少赛事ID');
  if (!rows.length) return jsonError('没有可导入的组别');

  return withEventDb((db) => {
    const competition = db.prepare('SELECT id FROM event_competitions WHERE id = ?').get(competitionId);
    if (!competition) return jsonError('赛事不存在', 404);

    const errors: Array<{ row: number; message: string }> = [];
    let created = 0;
    let updated = 0;
    const importRows = db.transaction((items: any[]) => {
      let nextSort = db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS value FROM event_groups WHERE competition_id = ?')
        .get(competitionId)?.value || 0;
      items.forEach((item, index) => {
        const name = cleanText(item.name ?? item['组别名称'] ?? item['组别']);
        if (!name) {
          errors.push({ row: index + 1, message: '组别名称不能为空' });
          return;
        }
        const code = cleanText(item.code ?? item['编码']);
        const existing = code
          ? db.prepare('SELECT id FROM event_groups WHERE competition_id = ? AND code = ?').get(competitionId, code)
          : db.prepare('SELECT id FROM event_groups WHERE competition_id = ? AND name = ?').get(competitionId, name);
        const payload = {
          name,
          code,
          category: cleanText(item.category ?? item['类别']),
          ageRange: cleanText(item.ageRange ?? item.age_range ?? item['年龄段']),
          danceType: cleanText(item.danceType ?? item.dance_type ?? item['舞种']),
          entryType: cleanText(item.entryType ?? item.entry_type ?? item['参赛形式'], 'solo'),
          sortOrder: toNumber(item.sortOrder ?? item.sort_order ?? item['排序'], ++nextSort),
          maxPlayers: toNumber(item.maxPlayers ?? item.max_players ?? item['人数上限']),
          registrationFee: toNumber(item.registrationFee ?? item.registration_fee ?? item['报名费']),
          scoreRuleId: toNumber(item.scoreRuleId ?? item.score_rule_id ?? item['评分规则ID']) || null,
          status: cleanText(item.status ?? item['状态'], 'active'),
        };
        if (existing) {
          db.prepare(`
            UPDATE event_groups
            SET name = ?, code = ?, category = ?, age_range = ?, dance_type = ?,
                entry_type = ?, sort_order = ?, max_players = ?, registration_fee = ?, score_rule_id = ?,
                status = ?, updated_at = ?
            WHERE id = ?
          `).run(
            payload.name,
            payload.code,
            payload.category,
            payload.ageRange,
            payload.danceType,
            payload.entryType,
            payload.sortOrder,
            payload.maxPlayers,
            payload.registrationFee,
            payload.scoreRuleId,
            payload.status,
            nowIso(),
            existing.id,
          );
          updated += 1;
          return;
        }
        db.prepare(`
          INSERT INTO event_groups (
            competition_id, name, code, category, age_range, dance_type, entry_type,
            sort_order, max_players, registration_fee, score_rule_id, scoring_status, status, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unlocked', ?, ?)
        `).run(
          competitionId,
          payload.name,
          payload.code,
          payload.category,
          payload.ageRange,
          payload.danceType,
          payload.entryType,
          payload.sortOrder,
          payload.maxPlayers,
          payload.registrationFee,
          payload.scoreRuleId,
          payload.status,
          nowIso(),
        );
        created += 1;
      });
    });

    importRows(rows);
    return Response.json({ success: true, data: { created, updated, errors } });
  });
}
