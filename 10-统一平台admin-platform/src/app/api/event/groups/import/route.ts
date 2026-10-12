import { normalizeImportRecord, importSourceRow } from '@/lib/event-import-format';
import { cleanText, readEventBody, hasAuth, jsonError, nowIso, toNumber, unauthorized, withRequestEventDb } from '../../_db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!hasAuth(request)) return unauthorized();

  const body = await readEventBody(request);
  const competitionId = toNumber(body.competitionId ?? body.competition_id);
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (!competitionId) return jsonError('缺少赛事ID');
  if (rows.some((item: unknown) => !item || typeof item !== 'object' || Array.isArray(item))) return jsonError('数据行格式不正确');
  if (rows.length > 2000) return jsonError('每次最多导入 2000 行');
  if (!rows.length) return jsonError('没有可导入的组别');

  return withRequestEventDb(request, (db) => {
    const competition = db.prepare('SELECT id FROM event_competitions WHERE id = ?').get(competitionId);
    if (!competition) return jsonError('赛事不存在', 404);

    const errors: Array<{ row: number; message: string }> = [];
    let created = 0;
    let updated = 0;
    const importRows = db.transaction((items: any[]) => {
      let nextSort = db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS value FROM event_groups WHERE competition_id = ?')
        .get(competitionId)?.value || 0;
      items.forEach((rawItem, index) => {
        const sourceRow = importSourceRow(rawItem, index + 2);
        let item: Record<string, unknown>;
        try {
          item = normalizeImportRecord({ ...rawItem, '组别名称': rawItem.name ?? rawItem['组别名称'] ?? rawItem['组别'], '序号': rawItem.sortOrder ?? rawItem.sort_order ?? rawItem['序号'] ?? rawItem['排序'] ?? '', '报名费': rawItem.registrationFee ?? rawItem.registration_fee ?? rawItem['报名费'] ?? '', '人数上限': rawItem.maxPlayers ?? rawItem.max_players ?? rawItem['人数上限'] ?? '', '评分规则ID': rawItem.scoreRuleId ?? rawItem.score_rule_id ?? rawItem['评分规则ID'] ?? '', '编码': rawItem.code ?? rawItem['编码'] ?? '', '年龄段': rawItem.ageRange ?? rawItem.age_range ?? rawItem['年龄段'] ?? '', '舞种': rawItem.danceType ?? rawItem.dance_type ?? rawItem['舞种'] ?? '', '参赛形式': rawItem.entryType ?? rawItem.entry_type ?? rawItem['参赛形式'] ?? 'solo', '状态': rawItem.status ?? rawItem['状态'] ?? 'active' }, 'groups');
        } catch (error: any) { errors.push({ row: sourceRow, message: error?.message || '数据格式不正确' }); return; }
        const name = cleanText(item.name ?? item['组别名称'] ?? item['组别']);
        if (!name) {
          errors.push({ row: sourceRow, message: '组别名称不能为空' });
          return;
        }
        const code = cleanText(item.code ?? item['编码']);
        const matches = db.prepare('SELECT * FROM event_groups WHERE competition_id=? AND trim(name)=?').all(competitionId, name);
        if (matches.length > 1) { errors.push({ row: sourceRow, message: '当前赛事存在同名组别，请先修改组别名称后再导入' }); return; }
        const existing = matches[0];
        const supplied = (field: string, ...aliases: string[]) => [field, ...aliases].some(key => Object.prototype.hasOwnProperty.call(rawItem, key));
        const payload = {
          name,
          code,
          ageRange: cleanText(item.ageRange ?? item.age_range ?? item['年龄段']),
          danceType: cleanText(item.danceType ?? item.dance_type ?? item['舞种']),
          entryType: cleanText(item.entryType ?? item.entry_type ?? item['参赛形式'], 'solo'),
          sortOrder: item['序号'] === '' ? ++nextSort : toNumber(item['序号']),
          maxPlayers: toNumber(item.maxPlayers ?? item.max_players ?? item['人数上限']),
          registrationFee: toNumber(item.registrationFee ?? item.registration_fee ?? item['报名费']),
          scoreRuleId: toNumber(item.scoreRuleId ?? item.score_rule_id ?? item['评分规则ID']) || null,
          status: cleanText(item.status ?? item['状态'], 'active'),
        };
        // Three-column templates must not erase settings absent from the file.
        if (existing) {
          if (!supplied('编码', 'code')) payload.code = existing.code || '';
          if (!supplied('年龄段', 'ageRange', 'age_range')) payload.ageRange = existing.age_range || '';
          if (!supplied('舞种', 'danceType', 'dance_type')) payload.danceType = existing.dance_type || '';
          if (!supplied('参赛形式', 'entryType', 'entry_type')) payload.entryType = existing.entry_type || 'solo';
          if (!supplied('序号', '排序', 'sortOrder', 'sort_order')) payload.sortOrder = existing.sort_order;
          if (!supplied('人数上限', 'maxPlayers', 'max_players')) payload.maxPlayers = existing.max_players;
          if (!supplied('评分规则ID', 'scoreRuleId', 'score_rule_id')) payload.scoreRuleId = existing.score_rule_id;
          if (!supplied('状态', 'status')) payload.status = existing.status;
        }
        nextSort = Math.max(nextSort, payload.sortOrder);
        if (existing) {
          db.prepare(`
            UPDATE event_groups
            SET name = ?, code = ?, age_range = ?, dance_type = ?,
                entry_type = ?, sort_order = ?, max_players = ?, registration_fee = ?, score_rule_id = ?,
                status = ?, updated_at = ?
            WHERE id = ?
          `).run(
            payload.name,
            payload.code,
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
          '',
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
