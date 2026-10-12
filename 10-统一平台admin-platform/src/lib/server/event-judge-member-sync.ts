import type { AdminDb } from './admin-db';
import { normalizeEventMemberPhone } from './event-member-sync';

function text(value: unknown, fallback = '') {
  const result = String(value ?? '').trim();
  return result || fallback;
}

function memberColumns(db: AdminDb) {
  return new Set((db.prepare('PRAGMA table_info(Member)').all() as Array<{ name: string }>).map((row) => row.name));
}

function normalizedPhoneSql(column: string) {
  const digits = `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(${column}, ''), '+', ''), ' ', ''), '-', ''), '(', ''), ')', '')`;
  return `(CASE WHEN length(${digits})=13 AND substr(${digits},1,2)='86' THEN substr(${digits},3) ELSE ${digits} END)`;
}

function findMember(db: AdminDb, judge: Record<string, any>) {
  const phone = normalizeEventMemberPhone(judge.phone);
  if (Number(judge.member_id || 0) > 0) {
    const byId = db.prepare("SELECT * FROM Member WHERE id=? AND COALESCE(status, 'active')!='deleted'").get(Number(judge.member_id));
    if (byId) return byId as Record<string, any>;
  }
  if (phone) {
    const byPhone = db.prepare(`
      SELECT * FROM Member
      WHERE ${normalizedPhoneSql('phone')}=? AND COALESCE(status, 'active')!='deleted'
      ORDER BY id LIMIT 1
    `).get(phone);
    if (byPhone) return byPhone as Record<string, any>;
  }
  const name = text(judge.name);
  if (name && !phone) {
    const byName = db.prepare(`
      SELECT * FROM Member
      WHERE lower(trim(COALESCE(name, '')))=lower(trim(?)) AND COALESCE(status, 'active')!='deleted'
      ORDER BY CASE WHEN COALESCE(phone, '')!='' THEN 0 ELSE 1 END, id LIMIT 1
    `).get(name);
    if (byName) return byName as Record<string, any>;
  }
  return null;
}

function markMemberAsJudge(db: AdminDb, member: Record<string, any>) {
  if ((db as any).eventOwnerId) return;
  const columns = memberColumns(db);
  const sets: string[] = [];
  const values: unknown[] = [];
  if (columns.has('remark') && !text(member.remark).includes('赛事评委')) {
    sets.push('remark=?');
    values.push([text(member.remark), '赛事评委'].filter(Boolean).join('；'));
  }
  if (columns.has('source') && !text(member.source)) {
    sets.push('source=?');
    values.push('event_judge');
  }
  if (!sets.length) return;
  values.push(member.id);
  db.prepare(`UPDATE Member SET ${sets.join(', ')} WHERE id=?`).run(...values);
}

function createMember(db: AdminDb, judge: Record<string, any>) {
  const columns = memberColumns(db);
  const phone = normalizeEventMemberPhone(judge.phone);
  const values: Record<string, unknown> = {
    name: text(judge.name, '赛事评委'),
    phone: phone || null,
    gender: '女',
    level: '体验学员',
    register_date: String(judge.created_at || new Date().toISOString()).slice(0, 10),
    country: '中国',
    remark: '赛事评委',
    source: 'event_judge',
    status: 'active',
  };
  const names = Object.keys(values).filter((column) => columns.has(column));
  const result = db.prepare(`INSERT INTO Member (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})`)
    .run(...names.map((name) => values[name]));
  return Number(result.lastInsertRowid);
}

export function ensureImportedJudgeMember(db: AdminDb, judge: Record<string, any>) {
  const member = findMember(db, judge);
  if (member) return Number(member.id);
  return createMember(db, judge);
}

export function ensureJudgeForMember(db: AdminDb, memberId: number) {
  const member = db.prepare("SELECT * FROM Member WHERE id=? AND COALESCE(status, 'active')!='deleted'").get(memberId) as Record<string, any> | undefined;
  if (!member) throw new Error('所选学员不存在');
  let judge = db.prepare('SELECT * FROM event_judges WHERE member_id=? ORDER BY id LIMIT 1').get(memberId) as Record<string, any> | undefined;
  if (!judge) {
    const phone = normalizeEventMemberPhone(member.phone);
    if (phone) judge = db.prepare(`SELECT * FROM event_judges WHERE ${normalizedPhoneSql('phone')}=? ORDER BY id LIMIT 1`).get(phone) as Record<string, any> | undefined;
  }
  if (!judge) {
    const result = db.prepare(`
      INSERT INTO event_judges (member_id, name, phone, status, auth_enabled, owner_user_id, updated_at)
      VALUES (?, ?, ?, 'active', 1, ?, ?)
    `).run(memberId, text(member.name, '评委'), text(member.phone), (db as any).eventActorId || 0, new Date().toISOString());
    judge = db.prepare('SELECT * FROM event_judges WHERE id=?').get(Number(result.lastInsertRowid)) as Record<string, any>;
  } else {
    db.prepare(`UPDATE event_judges SET member_id=?, name=?, phone=?, status='active', auth_enabled=1, updated_at=? WHERE id=?`)
      .run(memberId, text(member.name, judge.name), text(member.phone, judge.phone), new Date().toISOString(), judge.id);
    judge = { ...judge, member_id: memberId, name: text(member.name, judge.name), phone: text(member.phone, judge.phone) };
  }
  return judge;
}

export function syncAllEventJudgesToMembers(db: AdminDb) {
  const judges = db.prepare('SELECT * FROM event_judges ORDER BY id').all() as Array<Record<string, any>>;
  let linked = 0;
  let created = 0;
  db.transaction(() => {
    judges.forEach((judge) => {
      let member = findMember(db, judge);
      if (!member) {
        const memberId = createMember(db, judge);
        member = db.prepare('SELECT * FROM Member WHERE id=?').get(memberId) as Record<string, any>;
        created += 1;
      }
      markMemberAsJudge(db, member);
      if (Number(judge.member_id || 0) !== Number(member.id)) {
        db.prepare('UPDATE event_judges SET member_id=?, updated_at=? WHERE id=?').run(member.id, new Date().toISOString(), judge.id);
        linked += 1;
      }
    });
  })();
  return { total: judges.length, linked, created };
}
