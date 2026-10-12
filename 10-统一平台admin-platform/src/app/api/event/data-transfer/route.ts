import { readEventBody, hasAuth, jsonError, unauthorized, withRequestEventDb } from '../_db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TABLES = [
  'event_competitions',
  'event_judges',
  'event_score_rules',
  'event_groups',
  'event_sessions',
  'event_players',
  'event_group_judges',
  'event_music_files',
  'event_performances',
  'event_scores',
  'event_awards',
  'event_rankings',
  'event_certificates',
  'event_checkins',
  'event_result_publish_logs',
  'event_score_audit_logs',
  'event_bigscreen_states',
] as const;

function quoted(identifier: string) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function fileName() {
  return `event-data-${new Date().toISOString().slice(0, 10)}.json`;
}

export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();

  return withRequestEventDb(request, (db) => {
    const tables = Object.fromEntries(
      TABLES.map((table) => [table, db.prepare(`SELECT * FROM ${quoted(table)} ORDER BY id`).all().map((row: any) => { if (table === 'event_groups') { const { category, ...group } = row; return group; } return row; })]),
    );
    const payload = {
      format: 'eva-event-data',
      version: 1,
      exportedAt: new Date().toISOString(),
      tables,
    };

    return new Response(JSON.stringify(payload), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName()}"`,
        'Cache-Control': 'no-store',
      },
    });
  });
}

export async function POST(request: Request) {
  if (!hasAuth(request)) return unauthorized();

  const body = await readEventBody(request);
  if (!body || body.format !== 'eva-event-data' || Number(body.version) !== 1 || !body.tables) {
    return jsonError('文件格式不正确，请选择赛事管理导出的 JSON 文件');
  }

  try {
    return withRequestEventDb(request, (db) => {
      const summary: Record<string, { created: number; updated: number; skipped: number }> = {};

      const importAll = db.transaction(() => {
        for (const table of TABLES) {
          const rows = body.tables[table];
          const result = { created: 0, updated: 0, skipped: 0 };
          summary[table] = result;
          if (rows == null) continue;
          if (!Array.isArray(rows)) throw new Error(`${table} 必须是数组`);

          const allowedColumns = new Set<string>(
            db.prepare(`PRAGMA table_info(${quoted(table)})`).all().map((column: any) => String(column.name)),
          );
          const statementCache = new Map<string, any>();
          const exists = db.prepare(`SELECT 1 FROM ${quoted(table)} WHERE id = ?`);

          for (const row of rows as Record<string, unknown>[]) {
            if (!row || typeof row !== 'object' || Array.isArray(row)) {
              result.skipped += 1;
              continue;
            }
            const columns = Object.keys(row).filter((column) => allowedColumns.has(column) && !(table === 'event_groups' && column === 'category'));
            if (!columns.includes('id') || row.id == null) {
              result.skipped += 1;
              continue;
            }

            const wasPresent = Boolean(exists.get(row.id));
            const cacheKey = columns.join('|');
            let statement = statementCache.get(cacheKey);
            if (!statement) {
              const names = columns.map(quoted).join(', ');
              const values = columns.map(() => '?').join(', ');
              const updates = columns
                .filter((column) => column !== 'id')
                .map((column) => `${quoted(column)} = excluded.${quoted(column)}`)
                .join(', ');
              const conflict = updates ? `DO UPDATE SET ${updates}` : 'DO NOTHING';
              statement = db.prepare(
                `INSERT INTO ${quoted(table)} (${names}) VALUES (${values}) ON CONFLICT(id) ${conflict}`,
              );
              statementCache.set(cacheKey, statement);
            }
            statement.run(...columns.map((column) => row[column] ?? null));
            if (wasPresent) result.updated += 1;
            else result.created += 1;
          }
        }
      });

      importAll();
      return Response.json({ success: true, data: { mode: 'merge', summary } });
    });
  } catch (error: any) {
    return jsonError(`导入失败，未写入任何数据：${error?.message || '未知错误'}`);
  }
}
