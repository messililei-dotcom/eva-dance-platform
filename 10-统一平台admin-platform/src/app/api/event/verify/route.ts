import { hasAuth, unauthorized, withEventDb } from '../_db';
import { pagePayload, readPage } from '@/lib/server/pagination';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const eventTables = [
  'event_competitions',
  'event_groups',
  'event_sessions',
  'event_players',
  'event_performances',
  'event_judges',
  'event_group_judges',
  'event_score_rules',
  'event_scores',
  'event_rankings',
  'event_awards',
  'event_certificates',
  'event_checkins',
  'event_music_files',
  'event_result_publish_logs',
  'event_score_audit_logs',
  'event_bigscreen_states',
];

export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const paging = readPage(new URL(request.url), { pageSize: 20, maxPageSize: 100 });

  return withEventDb((db) => {
    const counts = Object.fromEntries(eventTables.map((table) => {
      const row = db.prepare(`SELECT COUNT(*) AS value FROM ${table}`).get();
      return [table, row?.value || 0];
    }));

    const issueSql = `
        SELECT 'player_without_group' AS type, id, name AS label
        FROM event_players
        WHERE group_id IS NULL OR group_id NOT IN (SELECT id FROM event_groups)
        UNION ALL
        SELECT 'group_without_rule' AS type, id, name AS label
        FROM event_groups
        WHERE score_rule_id IS NULL
        UNION ALL
        SELECT 'approved_player_without_score' AS type, p.id, p.name AS label
        FROM event_players p
        LEFT JOIN event_scores s ON s.player_id = p.id
        WHERE p.audit_status = 'approved'
        GROUP BY p.id
        HAVING COUNT(s.id) = 0
        UNION ALL
        SELECT 'judge_assignment_without_auth' AS type, gj.id, j.name || ' / ' || g.name AS label
        FROM event_group_judges gj
        LEFT JOIN event_judges j ON j.id = gj.judge_id
        LEFT JOIN event_groups g ON g.id = gj.group_id
        WHERE gj.auth_enabled = 0 OR j.auth_enabled = 0
    `;
    const issueTotalRow = db.prepare(`SELECT COUNT(*) AS value FROM (${issueSql})`).get() as { value?: number } | undefined;
    const issueTotal = Number(issueTotalRow?.value || 0);
    const issues = db.prepare(`SELECT * FROM (${issueSql}) ORDER BY type, id LIMIT ? OFFSET ?`).all(paging.pageSize, paging.offset);

    return Response.json({ success: true, data: { counts, ...pagePayload(issues, issueTotal, paging), issues } });
  });
}
