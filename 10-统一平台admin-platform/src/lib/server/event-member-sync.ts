import type { AdminDb } from './admin-db';

export type EventMemberInput = {
  memberId?: unknown;
  name?: unknown;
  phone?: unknown;
  gender?: unknown;
  birthday?: unknown;
  country?: unknown;
  province?: unknown;
  city?: unknown;
  address?: unknown;
  registeredAt?: unknown;
  legacyUid?: unknown;
};

export type EventMemberSyncResult = {
  memberId: number;
  created: boolean;
  matchedBy: 'name_phone' | 'name' | 'member_id' | 'legacy_uid' | 'created';
};

function text(value: unknown, fallback = '') {
  const result = String(value ?? '').trim();
  return result || fallback;
}

export function normalizeEventMemberPhone(value: unknown) {
  const digits = String(value ?? '').replace(/\D/g, '');
  const normalized = digits.length === 13 && digits.startsWith('86') ? digits.slice(2) : digits;
  return /^\d{6,20}$/.test(normalized) ? normalized : '';
}

function normalizedPhoneSql(column: string) {
  const digits = `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(${column}, ''), '+', ''), ' ', ''), '-', ''), '(', ''), ')', '')`;
  return `(CASE WHEN length(${digits})=13 AND substr(${digits},1,2)='86' THEN substr(${digits},3) ELSE ${digits} END)`;
}

function normalizedNameSql(column: string) {
  return `lower(trim(COALESCE(${column}, '')))`;
}

function memberColumns(db: AdminDb) {
  return new Set((db.prepare('PRAGMA table_info(Member)').all() as Array<{ name: string }>).map(row => row.name));
}

function canonicalMemberId(db: AdminDb, value: unknown, visited = new Set<number>()): number {
  const memberId = Number(value);
  if (!Number.isInteger(memberId) || memberId <= 0) return 0;
  if (visited.has(memberId)) return 0;
  visited.add(memberId);
  const columns = memberColumns(db);
  const mergedColumn = columns.has('merged_to_member_id') ? ', merged_to_member_id' : '';
  const row = db.prepare(`SELECT id${mergedColumn} FROM Member WHERE id=? LIMIT 1`).get<{ id: number; merged_to_member_id?: number }>(memberId);
  if (!row) return 0;
  const mergedId = Number(row.merged_to_member_id || 0);
  return mergedId > 0 ? canonicalMemberId(db, mergedId, visited) : Number(row.id);
}

function eventRemark(current: unknown, legacyUid: unknown) {
  const existing = text(current);
  const uid = text(legacyUid);
  const parts = existing ? existing.split('；').map(item => item.trim()).filter(Boolean) : [];
  if (!parts.some(item => item.includes('赛事参赛学员'))) parts.push('赛事参赛学员');
  if (uid && !parts.some(item => item.includes(`legacy_event_uid=${uid}`))) parts.push(`legacy_event_uid=${uid}`);
  return parts.join('；');
}

function isGeneratedName(value: unknown) {
  return /^(手机|微信|赛事)学员/.test(text(value)) || text(value) === '未知学员';
}

function dateOnly(value: unknown) {
  const raw = text(value);
  const match = raw.match(/^\d{4}-\d{2}-\d{2}/);
  return match?.[0] || new Date().toISOString().slice(0, 10);
}

function updateMemberFromEvent(db: AdminDb, memberId: number, input: EventMemberInput) {
  const columns = memberColumns(db);
  const current = db.prepare('SELECT * FROM Member WHERE id=?').get<Record<string, any>>(memberId);
  if (!current) return;

  const sets: string[] = [];
  const values: unknown[] = [];
  const set = (column: string, value: unknown) => {
    if (!columns.has(column)) return;
    sets.push(`${column}=?`);
    values.push(value);
  };

  const name = text(input.name);
  if (name && (!text(current.name) || isGeneratedName(current.name))) set('name', name);
  // A registration phone can belong to the person submitting entries for several players.
  // Keep it on event_players, but never copy it into a unified Member profile here.
  if (text(input.gender) && !text(current.gender)) set('gender', text(input.gender));
  if (text(input.birthday) && !text(current.birthday)) set('birthday', text(input.birthday));
  if (text(input.country) && !text(current.country)) set('country', text(input.country));
  if (text(input.province) && !text(current.province)) set('province', text(input.province));
  if (text(input.city) && !text(current.city)) set('city', text(input.city));
  if (text(input.address) && !text(current.address)) set('address', text(input.address));
  if (!text(current.source)) set('source', 'event_competition');
  set('remark', eventRemark(current.remark, input.legacyUid));
  if (text(current.status) === 'deleted') set('status', 'active');

  if (!sets.length) return;
  values.push(memberId);
  db.prepare(`UPDATE Member SET ${sets.join(', ')} WHERE id=?`).run(...values);
}

function insertEventMember(db: AdminDb, input: EventMemberInput) {
  const columns = memberColumns(db);
  const candidate: Record<string, unknown> = {
    name: text(input.name, '赛事学员'),
    phone: null,
    gender: text(input.gender, '女'),
    birthday: text(input.birthday),
    level: '体验学员',
    remark: eventRemark('', input.legacyUid),
    register_date: dateOnly(input.registeredAt),
    country: text(input.country, '中国'),
    province: text(input.province),
    city: text(input.city),
    address: text(input.address),
    source: 'event_competition',
    status: 'active',
  };
  const insertColumns = Object.keys(candidate).filter(column => columns.has(column));
  const placeholders = insertColumns.map(() => '?').join(', ');
  const result = db.prepare(`INSERT INTO Member (${insertColumns.join(', ')}) VALUES (${placeholders})`)
    .run(...insertColumns.map(column => candidate[column]));
  return Number(result.lastInsertRowid);
}

export function syncEventPlayerToMember(db: AdminDb, input: EventMemberInput): EventMemberSyncResult {
  const columns = memberColumns(db);
  if (!columns.has('id')) throw new Error('统一学员表 Member 不存在');

  const normalizedPhone = normalizeEventMemberPhone(input.phone);
  const name = text(input.name);
  const requestedMemberId = canonicalMemberId(db, input.memberId);
  if (requestedMemberId) {
    const requested = db.prepare('SELECT name FROM Member WHERE id=? LIMIT 1').get<{ name: string }>(requestedMemberId);
    const sameName = requested && name && text(requested.name).toLocaleLowerCase() === name.toLocaleLowerCase();
    if (requested && (sameName || isGeneratedName(requested.name))) {
      updateMemberFromEvent(db, requestedMemberId, input);
      return { memberId: requestedMemberId, created: false, matchedBy: 'member_id' };
    }
  }

  if (name && normalizedPhone) {
    const nationalSql = columns.has('phone_national_number')
      ? ` OR ${normalizedPhoneSql('phone_national_number')}=?`
      : '';
    const params = columns.has('phone_national_number')
      ? [name, normalizedPhone, normalizedPhone]
      : [name, normalizedPhone];
    const statusOrder = columns.has('status')
      ? "CASE WHEN COALESCE(status, 'active')='deleted' THEN 1 ELSE 0 END, "
      : '';
    const matched = db.prepare(`
      SELECT id
      FROM Member
      WHERE ${normalizedNameSql('name')}=${normalizedNameSql('?')}
        AND (${normalizedPhoneSql('phone')}=?${nationalSql})
      ORDER BY ${statusOrder}id
      LIMIT 1
    `).get<{ id: number }>(...params);
    if (matched?.id) {
      const memberId = canonicalMemberId(db, matched.id) || Number(matched.id);
      updateMemberFromEvent(db, memberId, input);
      return { memberId, created: false, matchedBy: 'name_phone' };
    }
  }

  const legacyUid = text(input.legacyUid);
  if (name && legacyUid && columns.has('remark')) {
    const matched = db.prepare(`
      SELECT id FROM Member
      WHERE ${normalizedNameSql('name')}=${normalizedNameSql('?')} AND remark LIKE ?
      ORDER BY id LIMIT 1
    `).get<{ id: number }>(name, `%legacy_event_uid=${legacyUid}%`);
    if (matched?.id) {
      const memberId = canonicalMemberId(db, matched.id) || Number(matched.id);
      updateMemberFromEvent(db, memberId, input);
      return { memberId, created: false, matchedBy: 'legacy_uid' };
    }
  }

  if (name && columns.has('source')) {
    const statusOrder = columns.has('status')
      ? "CASE WHEN COALESCE(status, 'active')='deleted' THEN 1 ELSE 0 END, "
      : '';
    const matched = db.prepare(`
      SELECT id FROM Member
      WHERE ${normalizedNameSql('name')}=${normalizedNameSql('?')}
        AND source='event_competition'
        AND COALESCE(phone, '')=''
      ORDER BY ${statusOrder}id
      LIMIT 1
    `).get<{ id: number }>(name);
    if (matched?.id) {
      const memberId = canonicalMemberId(db, matched.id) || Number(matched.id);
      updateMemberFromEvent(db, memberId, input);
      return { memberId, created: false, matchedBy: 'name' };
    }
  }

  const memberId = insertEventMember(db, input);
  return { memberId, created: true, matchedBy: 'created' };
}
