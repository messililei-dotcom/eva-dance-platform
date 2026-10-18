import { openEventDb } from './_db';
import { verifyLocalToken } from '../_local-auth';

const bodies = new WeakMap<Request, any>();
export async function readEventBody(request: Request) {
  if (!bodies.has(request)) bodies.set(request, await request.json().catch(() => ({})));
  return bodies.get(request);
}
export function eventActor(request: Request) {
  const bearer = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const raw = request.headers.get('cookie')?.split(';').map(s => s.trim()).find(s => s.startsWith('token=') || s.startsWith('admin_media_token='))?.split('=').slice(1).join('=');
  try { return verifyLocalToken(bearer || decodeURIComponent(raw || '')); } catch { return null; }
}

const quoted = (name: string) => `"${name.replaceAll('"', '""')}"`;
const denied = () => Response.json({ success: false, error: '无权限查看', message: '无权限查看' }, { status: 403 });

/** Per-connection SQLite scope. Reads use filtered TEMP views; writes retain real
 * table semantics (IDs, defaults, upserts) and are checked by TEMP row triggers.
 * No scope, trigger, or view is persisted into the shared production database. */
export function scopeEventDb(db: any, ownerId: number) {
  if (!Number.isSafeInteger(ownerId) || ownerId <= 0) throw new Error('无权限查看');
  const tables: string[] = db.prepare("SELECT name FROM main.sqlite_master WHERE type='table' AND name LIKE 'event_%'").all().map((r: any) => r.name);
  const columns = new Map<string, Set<string>>(tables.map(table => [table, new Set<string>(db.prepare(`PRAGMA main.table_info(${quoted(table)})`).all().map((r: any) => r.name))]));
  db.exec(`CREATE TEMP TABLE event_owned_competitions(id INTEGER PRIMARY KEY);
    INSERT INTO event_owned_competitions SELECT id FROM main.event_competitions WHERE owner_user_id=${ownerId} OR EXISTS (SELECT 1 FROM main.event_competition_admins ca WHERE ca.competition_id=main.event_competitions.id AND ca.user_id=${ownerId});
    CREATE TEMP TABLE event_owned_members(id INTEGER PRIMARY KEY);
    INSERT OR IGNORE INTO event_owned_members SELECT member_id FROM main.event_players WHERE competition_id IN (SELECT id FROM event_owned_competitions) AND member_id>0;
    INSERT OR IGNORE INTO event_owned_members SELECT member_id FROM main.event_judges j WHERE member_id>0 AND (owner_user_id=${ownerId} OR EXISTS (SELECT 1 FROM main.event_group_judges gj WHERE gj.judge_id=j.id AND gj.competition_id IN (SELECT id FROM event_owned_competitions)));`);
  const assert = (condition: string) => `SELECT CASE WHEN NOT (${condition}) THEN RAISE(ABORT, '无权限查看') END;`;
  const refs: Record<string, string> = { group_id: 'event_groups', current_group_id: 'event_groups', player_id: 'event_players', current_player_id: 'event_players', performance_id: 'event_performances', current_performance_id: 'event_performances', music_file_id: 'event_music_files', rule_id: 'event_score_rules', score_rule_id: 'event_score_rules', award_id: 'event_awards', score_id: 'event_scores' };
  for (const table of tables) {
    const cols = columns.get(table)!;
    let predicate: string;
    let oldAccess: string;
    let newAccess: string;
    if (table === 'event_competition_admins') {
      predicate = 'competition_id IN (SELECT id FROM temp.event_owned_competitions)';
      oldAccess = 'OLD.competition_id IN (SELECT id FROM event_owned_competitions) AND NOT EXISTS (SELECT 1 FROM main.event_competitions WHERE id=OLD.competition_id)'; newAccess = '0';
    } else if (table === 'event_competitions') {
      predicate = 'id IN (SELECT id FROM temp.event_owned_competitions)';
      oldAccess = 'OLD.id IN (SELECT id FROM event_owned_competitions)';
      newAccess = `NEW.id IN (SELECT id FROM event_owned_competitions) OR NEW.owner_user_id=${ownerId}`;
    } else if (table === 'event_judges') {
      const linked = (id: string) => `EXISTS (SELECT 1 FROM main.event_group_judges gj WHERE gj.judge_id=${id} AND gj.competition_id IN (SELECT id FROM event_owned_competitions))`;
      predicate = `owner_user_id=${ownerId} OR ${linked('main.event_judges.id')}`;
      oldAccess = `(OLD.owner_user_id=${ownerId} OR ${linked('OLD.id')})`;
      newAccess = `(NEW.owner_user_id=${ownerId} OR ${linked('NEW.id')})`;
    } else if (cols.has('competition_id')) {
      predicate = 'competition_id IN (SELECT id FROM temp.event_owned_competitions)';
      oldAccess = 'OLD.competition_id IN (SELECT id FROM event_owned_competitions)';
      newAccess = 'NEW.competition_id IN (SELECT id FROM event_owned_competitions)';
    } else {
      // Fail closed for any future event table without an ownership relationship.
      predicate = '0'; oldAccess = '0'; newAccess = '0';
    }
    db.exec(`CREATE TEMP VIEW ${quoted(table)} AS SELECT * FROM main.${quoted(table)} WHERE ${predicate}`);
    let checks = assert(newAccess);
    if (cols.has('member_id')) checks += assert('COALESCE(NEW.member_id,0)=0 OR NEW.member_id IN (SELECT id FROM event_owned_members)');
    if (cols.has('account_user_id')) checks += assert(`COALESCE(NEW.account_user_id,0)=0 OR NEW.account_user_id=${ownerId}`);
    if (cols.has('competition_id')) {
      checks += assert('EXISTS (SELECT 1 FROM main.event_competitions WHERE id=NEW.competition_id)');
      for (const [column, parent] of Object.entries(refs)) {
        if (!cols.has(column)) continue;
        checks += assert(`COALESCE(NEW.${column},0)=0 OR EXISTS (SELECT 1 FROM main.${parent} WHERE id=NEW.${column} AND competition_id=NEW.competition_id)`);
      }
      if (cols.has('judge_id')) checks += assert(`COALESCE(NEW.judge_id,0)=0 OR EXISTS (SELECT 1 FROM event_judges WHERE id=NEW.judge_id)`);
    }
    if (table === 'event_judges') {
      const unshared = `NOT EXISTS (SELECT 1 FROM main.event_group_judges WHERE judge_id=OLD.id AND competition_id NOT IN (SELECT id FROM event_owned_competitions))`;
      oldAccess += ` AND ${unshared}`;
    }
    db.exec(`CREATE TEMP TRIGGER scope_${table}_insert BEFORE INSERT ON main.${quoted(table)} BEGIN ${checks} END;
      CREATE TEMP TRIGGER scope_${table}_update BEFORE UPDATE ON main.${quoted(table)} BEGIN ${assert(oldAccess)} ${checks} ${assert('NEW.id=OLD.id')} ${cols.has('owner_user_id') ? assert('NEW.owner_user_id=OLD.owner_user_id') : assert('NEW.competition_id=OLD.competition_id')} END;
      CREATE TEMP TRIGGER scope_${table}_delete BEFORE DELETE ON main.${quoted(table)} BEGIN ${assert(oldAccess)} END;`);
  }
  db.exec(`CREATE TEMP TRIGGER scope_new_competition AFTER INSERT ON main.event_competitions BEGIN INSERT INTO event_owned_competitions VALUES(NEW.id); END;
    CREATE TEMP VIEW Member AS SELECT * FROM main.Member WHERE id IN (SELECT id FROM temp.event_owned_members);
    CREATE TEMP TRIGGER scope_new_member AFTER INSERT ON main.Member BEGIN INSERT INTO event_owned_members VALUES(NEW.id); END;`);
  // Member profiles can be read for registrations, but account administrators
  // cannot modify unified student records as a side effect of an event action.
  db.exec(`CREATE TEMP TRIGGER scope_member_update BEFORE UPDATE ON main.Member BEGIN SELECT RAISE(ABORT,'无权限查看'); END;
    CREATE TEMP TRIGGER scope_member_delete BEFORE DELETE ON main.Member BEGIN SELECT RAISE(ABORT,'无权限查看'); END;`);
  const prepare = db.prepare.bind(db);
  db.prepare = (sql: string) => prepare(sql.replace(/\b(INSERT\s+(?:OR\s+\w+\s+)?INTO|UPDATE|DELETE\s+FROM)\s+("?)(event_[a-z_]+|Member)\2(?=\s|\()/gi, '$1 main.$3'));
  db.eventOwnerId = ownerId;
}

export function withRequestEventDb(request: Request, fn: (db: any) => any) {
  const actor = eventActor(request);
  if (!actor) return Response.json({ success: false, error: '未登录' }, { status: 401 });
  const db: any = openEventDb();
  try {
    db.eventActorId = actor.id;
    if (actor.role === 'event_admin') {
      const requestPath = new URL(request.url).pathname.replace(/^\/(local-api|legacy-student-api)/, '/api');
      if (request.method === 'POST' && ['/api/event/competitions', '/api/event/data-transfer'].includes(requestPath)) return denied();
      scopeEventDb(db, actor.id);
      const url = new URL(request.url);
      const path = url.pathname.replace(/^\/(local-api|legacy-student-api)/, '/api');
      const resource = path.match(/\/api\/event\/(competitions|groups|players|judges)\/(\d+)(?:\/payments)?$/);
      const accessible = (table: string, value: unknown) => !value || (!!db.prepare(`SELECT id FROM ${table} WHERE id=?`).get(value));
      if (resource && !accessible(`event_${resource[1]}`, resource[2])) return denied();
      const references: Record<string, string> = { memberId: 'Member', member_id: 'Member', competitionId: 'event_competitions', competition_id: 'event_competitions', groupId: 'event_groups', group_id: 'event_groups', playerId: 'event_players', player_id: 'event_players', judgeId: 'event_judges', judge_id: 'event_judges', scoreRuleId: 'event_score_rules', score_rule_id: 'event_score_rules', performanceId: 'event_performances', performance_id: 'event_performances' };
      const body = bodies.get(request) || {};
      for (const [field, table] of Object.entries(references)) {
        if (!accessible(table, url.searchParams.get(field)) || !accessible(table, body[field])) return denied();
      }
      const arrays: Record<string, string> = { groupIds: 'event_groups', group_ids: 'event_groups', judgeIds: 'event_judges', judge_ids: 'event_judges', memberIds: 'Member', member_ids: 'Member', ids: path.includes('/players/') ? 'event_players' : '' };
      for (const [field, table] of Object.entries(arrays)) if (table && Array.isArray(body[field]) && body[field].some((id: unknown) => !accessible(table, id))) return denied();
      // Restore/import keeps ownership immutable and cannot claim existing data.
      if (path.endsWith('/data-transfer') && request.method === 'POST') {
        for (const table of ['event_competitions', 'event_judges']) {
          const rows = body.tables?.[table];
          if (Array.isArray(rows)) for (const row of rows) {
            if (!row || typeof row !== 'object') continue;
            const existing = db.prepare(`SELECT owner_user_id FROM main.${table} WHERE id=?`).get(row.id);
            if (existing && existing.owner_user_id !== actor.id) return denied();
            row.owner_user_id = actor.id;
            if (table === 'event_competitions') row.created_by = String(actor.id);
          }
        }
      }
      return db.transaction(() => fn(db))();
    }
    return fn(db);
  } catch (error: any) {
    if (String(error?.message).includes('无权限查看')) return denied();
    throw error;
  } finally { db.close(); }
}
