import { normalizeImportRecord, importSourceRow } from '@/lib/event-import-format';
import { normalizeEventMemberPhone } from './event-member-sync';


const text = (value: unknown) => String(value ?? '').trim();
function phone(value: unknown) {
  const raw = text(value);
  const normalized = normalizeEventMemberPhone(raw);
  if (!normalized) throw new Error('手机号格式不正确，请填写号码，不要填写文字');
  return normalized;
}

// Resolve only the supplied phone against unified profiles. The scoped event
// administrator receives no global profile fields and cannot modify that profile.
export function ensurePhoneMember(db: any, name: string, contact: string, source: string) {
  const columns = new Set(db.prepare('PRAGMA main.table_info(Member)').all().map((r: any) => r.name));
  const normalizeSql = (column: string) => {
    const digits = `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(${column}, ''), '+', ''), ' ', ''), '-', ''), '(', ''), ')', '')`;
    return `(CASE WHEN length(${digits})=13 AND substr(${digits},1,2)='86' THEN substr(${digits},3) ELSE ${digits} END)`;
  };
  const extra = columns.has('phone_national_number') ? ` OR ${normalizeSql('phone_national_number')}=?` : '';
  const matches = db.prepare(`SELECT id FROM main.Member WHERE (${normalizeSql('phone')}=?${extra}) AND COALESCE(status,'active')!='deleted'`)
    .all(...(extra ? [contact, contact] : [contact]));
  // Older event imports kept the contact phone only on registrations/judges.
  // Reuse their linked profile when no unified profile has that phone yet.
  if (!matches.length) {
    matches.push(...db.prepare(`SELECT DISTINCT m.id FROM main.Member m JOIN (
      SELECT member_id FROM main.event_players WHERE ${normalizeSql('phone')}=? AND member_id>0
      UNION SELECT member_id FROM main.event_judges WHERE ${normalizeSql('phone')}=? AND member_id>0
    ) e ON e.member_id=m.id WHERE COALESCE(m.status,'active')!='deleted'`).all(contact, contact));
  }
  const ids = new Set<number>();
  for (const match of matches) {
    let id = Number(match.id);
    const visited = new Set<number>();
    while (columns.has('merged_to_member_id')) {
      if (visited.has(id)) throw new Error('手机号关联的人员合并记录异常，请先核对');
      visited.add(id);
      const next = Number(db.prepare('SELECT merged_to_member_id FROM main.Member WHERE id=?').get(id)?.merged_to_member_id || 0);
      if (!next) break;
      if (!db.prepare('SELECT id FROM main.Member WHERE id=?').get(next)) throw new Error('手机号关联的人员记录不存在');
      id = next;
    }
    ids.add(id);
  }
  if (ids.size > 1) throw new Error('手机号匹配到多个人员，请先合并或核对数据库');
  let memberId = [...ids][0];
  if (!memberId) {
    const values: Record<string, unknown> = { name, phone: contact, gender: '女', level: '体验学员', register_date: new Date().toISOString().slice(0,10), country: '中国', source, status: 'active', remark: source === 'event_judge' ? '赛事评委' : '赛事参赛学员' };
    const names = Object.keys(values).filter(key => columns.has(key));
    memberId = Number(db.prepare(`INSERT INTO Member (${names.join(',')}) VALUES (${names.map(() => '?').join(',')})`).run(...names.map(key => values[key])).lastInsertRowid);
  }
  if (db.eventOwnerId) db.prepare('INSERT OR IGNORE INTO temp.event_owned_members(id) VALUES (?)').run(memberId);
  return memberId;
}

export function importEventRegistration(db: any, competitionId: number, item: Record<string, unknown>) {
  const name = text(item['选手姓名']);
  const groupName = text(item['组别名称']);
  if (!name) throw new Error('选手姓名不能为空');
  if (!groupName) throw new Error('组别名称不能为空');
  const groups = db.prepare('SELECT id,name,registration_fee FROM event_groups WHERE competition_id=? AND trim(name)=?').all(competitionId, groupName);
  if (!groups.length) throw new Error('当前赛事没有匹配的组别，请核对完整组别名称');
  if (groups.length > 1) throw new Error('当前赛事存在同名组别，请先修改组别名称后再导入');
  const groupId = groups[0].id;
  const contact = phone(item['手机号']);
  const existing = db.prepare('SELECT * FROM event_players WHERE competition_id=? AND group_id=?').all(competitionId, groupId)
    .filter((player: any) => normalizeEventMemberPhone(player.phone) === contact);
  if (existing.length > 1) throw new Error('存在多条同手机号报名，请在报名列表中处理');
  const memberId = ensurePhoneMember(db, name, contact, 'event_competition');
  const now = new Date().toISOString();
  let playerId: number;
  if (existing.length) {
    playerId = existing[0].id;
    // Preserve review, payment and scoring states when updating registration details.
    db.prepare('UPDATE event_players SET member_id=?, name=?, phone=?, organization=?, teacher=?, updated_at=? WHERE id=?')
      .run(memberId, name, contact, text(item['领队机构']), text(item['领队老师']), now, playerId);
  } else {
    const result = db.prepare(`INSERT INTO event_players
      (competition_id,group_id,member_id,player_no,name,phone,organization,teacher,status,audit_status,paid_status,score_status,updated_at,registration_fee)
      VALUES (?,?,?,'',?,?,?,?,'approved','approved','unpaid','not_started',?,?)`)
      .run(competitionId, groupId, memberId, name, contact, text(item['领队机构']), text(item['领队老师']), now, Number(groups[0].registration_fee || 0));
    playerId = Number(result.lastInsertRowid);
  }
  const title = text(item['节目名称']);
  if (title) {
    const performance = db.prepare('SELECT id FROM event_performances WHERE player_id=? ORDER BY id DESC LIMIT 1').get(playerId);
    if (performance) db.prepare('UPDATE event_performances SET title=?,updated_at=? WHERE id=?').run(title, now, performance.id);
    else db.prepare(`INSERT INTO event_performances (competition_id,group_id,player_id,title,status,updated_at) VALUES (?,?,?,?,'pending',?)`)
      .run(competitionId, groupId, playerId, title, now);
  }
  return existing.length ? 'updated' : 'created';
}

export function importEventJudge(db: any, competitionId: number, item: Record<string, unknown>) {
  const name = text(item['评委姓名']);
  if (!name) throw new Error('评委姓名不能为空');
  const groupName = text(item['组别名称']);
  if (!groupName) throw new Error('组别不能为空');
  const groups = db.prepare('SELECT id,name FROM event_groups WHERE competition_id=? AND trim(name)=?').all(competitionId, groupName);
  if (!groups.length) throw new Error('当前赛事没有匹配的组别，请核对完整组别名称');
  if (groups.length > 1) throw new Error('当前赛事存在同名组别，请先修改组别名称后再导入');
  const groupId = groups[0].id;
  const contact = phone(item['手机号']);
  const candidates = db.prepare('SELECT * FROM event_judges').all()
    .filter((judge: any) => normalizeEventMemberPhone(judge.phone) === contact);
  if (candidates.length > 1) throw new Error('存在多名同手机号评委，请先核对名单');
  const memberId = ensurePhoneMember(db, name, contact, 'event_judge');
  const now = new Date().toISOString();
  let judgeId: number;
  const action = candidates.length ? 'updated' : 'created';
  if (candidates.length) {
    judgeId = candidates[0].id;
    db.prepare('UPDATE event_judges SET member_id=?,name=?,phone=?,title=?,organization=?,updated_at=? WHERE id=?')
      .run(memberId, name, contact, Object.prototype.hasOwnProperty.call(item, '职称') ? text(item['职称']) : candidates[0].title, text(item['所属机构']), now, judgeId);
  } else {
    judgeId = Number(db.prepare(`INSERT INTO event_judges (member_id,name,phone,title,organization,status,auth_enabled,owner_user_id,updated_at)
      VALUES (?,?,?,?,?,'active',1,?,?)`)
      .run(memberId, name, contact, text(item['职称']), text(item['所属机构']), db.eventActorId || 0, now).lastInsertRowid);
  }
  const assigned = db.prepare(`INSERT INTO event_group_judges
    (competition_id,group_id,judge_id,role,weight,auth_enabled,status,updated_at)
    VALUES (?,?,?,'judge',1,1,'active',?) ON CONFLICT(group_id,judge_id) DO NOTHING`)
    .run(competitionId, groupId, judgeId, now).changes;
  if (assigned) db.prepare("UPDATE event_judges SET auth_enabled=1,status='active',updated_at=? WHERE id=?").run(now, judgeId);
  return { action, assigned: Number(assigned), skipped: assigned ? 0 : 1 };
}

export function importEventEntries(db: any, competitionId: number, rows: Record<string, unknown>[], kind: 'players' | 'judges') {
  if (!db.prepare('SELECT id FROM event_competitions WHERE id=?').get(competitionId)) throw new Error('赛事不存在');
  const result = { created: 0, updated: 0, assigned: 0, skipped: 0, errors: [] as Array<{ row: number; message: string }> };
  const write = kind === 'players' ? importEventRegistration : importEventJudge;
  rows.forEach((row, index) => {
    try {
      const outcome = db.transaction(() => write(db, competitionId, normalizeImportRecord(row, kind)))();
      const action = typeof outcome === 'string' ? outcome : outcome.action;
      if (typeof outcome !== 'string') { result.assigned += outcome.assigned; result.skipped += outcome.skipped; }
      if (action === 'created') result.created++; else result.updated++;
    } catch (error: any) {
      if (String(error?.message).includes('无权限查看')) throw error;
      const message = String(error?.message || '导入失败');
      result.errors.push({ row: importSourceRow(row, index + 2), message: message.includes('SQLITE') || message.includes('constraint') ? '数据冲突，请核对姓名和手机号' : message });
    }
  });
  return result;
}
