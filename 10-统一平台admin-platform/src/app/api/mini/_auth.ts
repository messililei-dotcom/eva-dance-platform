import { formatMemberPhoneForDisplay } from '@/lib/member-phone-display';
import { findPhoneMembers, samePhoneIdentity } from '@/lib/server/event-phone-member';
import type { AdminDb } from '@/lib/server/admin-db';
import { cleanText, memberToken } from './_helpers';
import { normalizePhoneIdentity } from '../course/series/[id]/_authorization';
import { createWelcomeMessage } from '@/lib/server/inbox';
import { moveWechatIdentities } from '@/lib/server/wechat-identity';

type MemberRow = Record<string, any> & { id: unknown; phone?: unknown };
type MergeIdentity = { phone: string; wxOpenid: string; wxUnionid: string; wxName: string };

function tableExists(db: AdminDb, table: string) {
  return Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table));
}

function tableColumns(db: AdminDb, table: string) {
  if (!tableExists(db, table)) return new Set<string>();
  return new Set((db.prepare(`PRAGMA table_info('${table.replace(/'/g, "''")}')`).all() as Array<{ name: string }>).map(row => row.name));
}

function sqlMaxDate(column: string, value: string) {
  return `CASE
    WHEN COALESCE(${column}, '')='' THEN ${value}
    WHEN COALESCE(${value}, '')='' THEN ${column}
    WHEN datetime(${value}) > datetime(${column}) THEN ${value}
    ELSE ${column}
  END`;
}

function sqlMinDate(column: string, value: string) {
  return `CASE
    WHEN COALESCE(${column}, '')='' THEN ${value}
    WHEN COALESCE(${value}, '')='' THEN ${column}
    WHEN datetime(${value}) < datetime(${column}) THEN ${value}
    ELSE ${column}
  END`;
}

function generatedWechatName(name: unknown) {
  return /^微信学员[A-Za-z0-9_-]{4,}$/.test(cleanText(name));
}

function fallbackPhoneName(phone: string) {
  return `手机学员${phone.slice(-4)}`;
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const text = cleanText(value);
    if (text) return text;
  }
  return '';
}

function remarkMergedToMemberId(value: unknown) {
  const match = cleanText(value).match(/member_id\s*=\s*(\d+)/i);
  return match ? Number(match[1]) || 0 : 0;
}

function getMember(db: AdminDb, id: unknown) {
  const memberId = Number(id);
  if (!Number.isInteger(memberId) || memberId <= 0) return null;
  return db.prepare('SELECT * FROM Member WHERE id=?').get<MemberRow>(memberId) || null;
}

export function canonicalMember(db: AdminDb, member: MemberRow | null) {
  const targetId = Number(member?.merged_to_member_id || 0) || remarkMergedToMemberId(member?.remark);
  if (!member || !targetId || targetId === Number(member.id)) return member;
  return getMember(db, targetId) || member;
}

function reassignSimpleMemberIdRows(db: AdminDb, table: string, sourceId: number, targetId: number, identity: MergeIdentity) {
  const cols = tableColumns(db, table);
  if (!cols.has('member_id')) return;
  const sets = ['member_id=?'];
  const values: unknown[] = [targetId];
  if (cols.has('phone')) {
    sets.push("phone=CASE WHEN ?<>'' THEN ? ELSE phone END");
    values.push(identity.phone, identity.phone);
  }
  if (cols.has('wx_openid')) {
    sets.push("wx_openid=CASE WHEN ?<>'' THEN ? ELSE wx_openid END");
    values.push(identity.wxOpenid, identity.wxOpenid);
  }
  if (cols.has('wx_unionid')) {
    sets.push("wx_unionid=CASE WHEN ?<>'' THEN ? ELSE wx_unionid END");
    values.push(identity.wxUnionid, identity.wxUnionid);
  }
  if (cols.has('wx_name')) {
    sets.push("wx_name=CASE WHEN ?<>'' THEN ? ELSE wx_name END");
    values.push(identity.wxName, identity.wxName);
  }
  values.push(sourceId);
  db.prepare(`UPDATE ${table} SET ${sets.join(', ')} WHERE member_id=?`).run(...values);
}

function reassignMemberIdRowById(db: AdminDb, table: string, rowId: unknown, targetId: number, identity: MergeIdentity) {
  const cols = tableColumns(db, table);
  if (!cols.has('id') || !cols.has('member_id')) return;
  const sets = ['member_id=?'];
  const values: unknown[] = [targetId];
  if (cols.has('phone')) {
    sets.push("phone=CASE WHEN ?<>'' THEN ? ELSE phone END");
    values.push(identity.phone, identity.phone);
  }
  if (cols.has('wx_openid')) {
    sets.push("wx_openid=CASE WHEN ?<>'' THEN ? ELSE wx_openid END");
    values.push(identity.wxOpenid, identity.wxOpenid);
  }
  if (cols.has('wx_unionid')) {
    sets.push("wx_unionid=CASE WHEN ?<>'' THEN ? ELSE wx_unionid END");
    values.push(identity.wxUnionid, identity.wxUnionid);
  }
  if (cols.has('wx_name')) {
    sets.push("wx_name=CASE WHEN ?<>'' THEN ? ELSE wx_name END");
    values.push(identity.wxName, identity.wxName);
  }
  values.push(rowId);
  db.prepare(`UPDATE ${table} SET ${sets.join(', ')} WHERE id=?`).run(...values);
}

function mergeVideoProgress(db: AdminDb, sourceId: number, targetId: number, identity: MergeIdentity) {
  if (!tableExists(db, 'VideoProgress')) return;
  const cols = tableColumns(db, 'VideoProgress');
  const rows = db.prepare('SELECT * FROM VideoProgress WHERE member_id=?').all<Record<string, any>>(sourceId);
  rows.forEach(row => {
    const existing = db.prepare('SELECT * FROM VideoProgress WHERE member_id=? AND video_id=?').get<Record<string, any>>(targetId, row.video_id);
    if (existing) {
      const sets = [
        'progress=MAX(COALESCE(progress, 0), COALESCE(?, 0))',
        'duration=MAX(COALESCE(duration, 0), COALESCE(?, 0))',
        'completed=CASE WHEN COALESCE(completed, 0)=1 OR COALESCE(?, 0)=1 THEN 1 ELSE 0 END',
      ];
      const values: unknown[] = [row.progress || 0, row.duration || 0, row.completed || 0];
      if (cols.has('last_play_at')) {
        sets.push(`last_play_at=${sqlMaxDate('last_play_at', '?')}`);
        values.push(row.last_play_at || null, row.last_play_at || null, row.last_play_at || null, row.last_play_at || null);
      }
      if (cols.has('phone')) {
        sets.push("phone=CASE WHEN ?<>'' THEN ? ELSE phone END");
        values.push(identity.phone, identity.phone);
      }
      if (cols.has('wx_openid')) {
        sets.push("wx_openid=CASE WHEN ?<>'' THEN ? ELSE wx_openid END");
        values.push(identity.wxOpenid, identity.wxOpenid);
      }
      if (cols.has('wx_unionid')) {
        sets.push("wx_unionid=CASE WHEN ?<>'' THEN ? ELSE wx_unionid END");
        values.push(identity.wxUnionid, identity.wxUnionid);
      }
      if (cols.has('wx_name')) {
        sets.push("wx_name=CASE WHEN ?<>'' THEN ? ELSE wx_name END");
        values.push(identity.wxName, identity.wxName);
      }
      values.push(existing.id);
      db.prepare(`UPDATE VideoProgress SET ${sets.join(', ')} WHERE id=?`).run(...values);
      db.prepare('DELETE FROM VideoProgress WHERE id=?').run(row.id);
      return;
    }
    reassignMemberIdRowById(db, 'VideoProgress', row.id, targetId, identity);
  });
}

function mergeCourseSeriesVisit(db: AdminDb, sourceId: number, targetId: number, identity: MergeIdentity) {
  if (!tableExists(db, 'CourseSeriesVisit')) return;
  const cols = tableColumns(db, 'CourseSeriesVisit');
  const rows = db.prepare('SELECT * FROM CourseSeriesVisit WHERE member_id=?').all<Record<string, any>>(sourceId);
  rows.forEach(row => {
    const existing = db.prepare('SELECT * FROM CourseSeriesVisit WHERE member_id=? AND series_id=?').get<Record<string, any>>(targetId, row.series_id);
    if (existing) {
      const sets = [
        `first_visited_at=${sqlMinDate('first_visited_at', '?')}`,
        `last_visited_at=${sqlMaxDate('last_visited_at', '?')}`,
        'visit_count=COALESCE(visit_count, 0) + COALESCE(?, 0)',
        "source=CASE WHEN COALESCE(source, '')='' THEN ? ELSE source END",
      ];
      const values: unknown[] = [
        row.first_visited_at || null,
        row.first_visited_at || null,
        row.first_visited_at || null,
        row.first_visited_at || null,
        row.last_visited_at || null,
        row.last_visited_at || null,
        row.last_visited_at || null,
        row.last_visited_at || null,
        row.visit_count || 0,
        row.source || 'learn',
      ];
      if (cols.has('phone')) {
        sets.push("phone=CASE WHEN ?<>'' THEN ? ELSE phone END");
        values.push(identity.phone, identity.phone);
      }
      if (cols.has('wx_openid')) {
        sets.push("wx_openid=CASE WHEN ?<>'' THEN ? ELSE wx_openid END");
        values.push(identity.wxOpenid, identity.wxOpenid);
      }
      if (cols.has('wx_unionid')) {
        sets.push("wx_unionid=CASE WHEN ?<>'' THEN ? ELSE wx_unionid END");
        values.push(identity.wxUnionid, identity.wxUnionid);
      }
      if (cols.has('wx_name')) {
        sets.push("wx_name=CASE WHEN ?<>'' THEN ? ELSE wx_name END");
        values.push(identity.wxName, identity.wxName);
      }
      values.push(existing.id);
      db.prepare(`UPDATE CourseSeriesVisit SET ${sets.join(', ')} WHERE id=?`).run(...values);
      db.prepare('DELETE FROM CourseSeriesVisit WHERE id=?').run(row.id);
      return;
    }
    reassignMemberIdRowById(db, 'CourseSeriesVisit', row.id, targetId, identity);
  });
}

function cancelMergedPhoneMember(db: AdminDb, sourceId: number, targetId: number) {
  const cols = tableColumns(db, 'Member');
  const sets = ["status='merged'"];
  if (cols.has('merged_to_member_id')) sets.push('merged_to_member_id=?');
  if (cols.has('phone')) sets.push('phone=NULL');
  if (cols.has('phone_national_number')) sets.push('phone_national_number=NULL');
  if (cols.has('phone_country_code')) sets.push('phone_country_code=NULL');
  if (cols.has('wx_openid')) sets.push('wx_openid=NULL');
  if (cols.has('wx_unionid')) sets.push('wx_unionid=NULL');
  if (cols.has('wx_session_key')) sets.push('wx_session_key=NULL');
  if (cols.has('wx_session_updated_at')) sets.push('wx_session_updated_at=NULL');
  if (cols.has('remark')) {
    sets.push("remark=trim(COALESCE(remark, '') || CASE WHEN COALESCE(remark, '')<>'' THEN char(10) ELSE '' END || ?)");
    const values = cols.has('merged_to_member_id')
      ? [targetId, `已合并到主账号 member_id=${targetId}`, sourceId]
      : [`已合并到主账号 member_id=${targetId}`, sourceId];
    db.prepare(`UPDATE Member SET ${sets.join(', ')} WHERE id=?`).run(...values);
    return;
  }
  const values = cols.has('merged_to_member_id') ? [targetId, sourceId] : [sourceId];
  db.prepare(`UPDATE Member SET ${sets.join(', ')} WHERE id=?`).run(...values);
}

function mergeIdentity(targetMember: MemberRow, sourceMember: MemberRow, phone: string): MergeIdentity {
  const normalizedPhone = (phone.startsWith('+') ? phone : normalizePhoneIdentity(phone))
    || normalizePhoneIdentity(targetMember.phone)
    || normalizePhoneIdentity(targetMember.phone_national_number)
    || normalizePhoneIdentity(sourceMember.phone)
    || normalizePhoneIdentity(sourceMember.phone_national_number);
  return {
    phone: normalizedPhone || phone,
    wxOpenid: firstText(targetMember.wx_openid, sourceMember.wx_openid),
    wxUnionid: firstText(targetMember.wx_unionid, sourceMember.wx_unionid),
    wxName: firstText(
      targetMember.wx_name,
      targetMember.wx_nickname,
      targetMember.name,
      sourceMember.wx_name,
      sourceMember.wx_nickname,
      sourceMember.name,
    ),
  };
}

function updateTargetMemberFromMerge(db: AdminDb, targetMember: MemberRow, sourceMember: MemberRow, identity: MergeIdentity, sourceLabel: string) {
  const memberCols = tableColumns(db, 'Member');
  const memberSets = [
    "status='active'",
    "source=CASE WHEN COALESCE(source, '') IN ('', 'wechat_silent') THEN ? ELSE source END",
  ];
  const memberValues: unknown[] = [sourceLabel];

  if (memberCols.has('phone')) {
    memberSets.push("phone=CASE WHEN ?<>'' THEN ? ELSE phone END");
    memberValues.push(identity.phone, identity.phone);
  }
  if (memberCols.has('phone_country_code')) {
    memberSets.push("phone_country_code=CASE WHEN COALESCE(phone_country_code, '')='' THEN COALESCE(?, phone_country_code) ELSE phone_country_code END");
    memberValues.push(sourceMember.phone_country_code || targetMember.phone_country_code || '+86');
  }
  if (memberCols.has('phone_national_number')) {
    memberSets.push("phone_national_number=CASE WHEN COALESCE(phone_national_number, '')='' THEN COALESCE(?, phone_national_number) ELSE phone_national_number END");
    memberValues.push(sourceMember.phone_national_number || targetMember.phone_national_number || identity.phone || null);
  }
  if (memberCols.has('wx_openid')) {
    memberSets.push("wx_openid=CASE WHEN COALESCE(wx_openid, '')='' THEN ? ELSE wx_openid END");
    memberValues.push(identity.wxOpenid);
  }
  if (memberCols.has('wx_unionid')) {
    memberSets.push("wx_unionid=CASE WHEN COALESCE(wx_unionid, '')='' THEN ? ELSE wx_unionid END");
    memberValues.push(identity.wxUnionid);
  }
  if (memberCols.has('wx_session_key')) {
    memberSets.push("wx_session_key=CASE WHEN COALESCE(wx_session_key, '')='' THEN COALESCE(?, wx_session_key) ELSE wx_session_key END");
    memberValues.push(sourceMember.wx_session_key || targetMember.wx_session_key || null);
  }
  if (memberCols.has('wx_session_updated_at')) {
    memberSets.push("wx_session_updated_at=CASE WHEN wx_session_updated_at IS NULL THEN COALESCE(?, wx_session_updated_at) ELSE wx_session_updated_at END");
    memberValues.push(sourceMember.wx_session_updated_at || targetMember.wx_session_updated_at || null);
  }
  if (memberCols.has('wx_nickname')) {
    memberSets.push("wx_nickname=CASE WHEN COALESCE(wx_nickname, '')='' THEN COALESCE(?, wx_nickname) ELSE wx_nickname END");
    memberValues.push(sourceMember.wx_nickname || targetMember.wx_nickname || null);
  }
  if (memberCols.has('wx_avatar_url')) {
    memberSets.push("wx_avatar_url=CASE WHEN COALESCE(wx_avatar_url, '')='' THEN COALESCE(?, wx_avatar_url) ELSE wx_avatar_url END");
    memberValues.push(sourceMember.wx_avatar_url || targetMember.wx_avatar_url || null);
  }
  if (memberCols.has('wx_profile_synced_at')) {
    memberSets.push("wx_profile_synced_at=CASE WHEN wx_profile_synced_at IS NULL THEN COALESCE(?, wx_profile_synced_at) ELSE wx_profile_synced_at END");
    memberValues.push(sourceMember.wx_profile_synced_at || targetMember.wx_profile_synced_at || null);
  }
  if (memberCols.has('name')) {
    const sourceName = cleanText(sourceMember.name);
    memberSets.push("name=CASE WHEN (name LIKE '微信学员%' OR name LIKE '手机学员%') AND ?<>'' THEN ? ELSE name END");
    memberValues.push(sourceName, sourceName);
  }
  ['country', 'province', 'city', 'address', 'birthday'].forEach(column => {
    if (memberCols.has(column)) {
      memberSets.push(`${column}=CASE WHEN COALESCE(${column}, '')='' THEN COALESCE(?, ${column}) ELSE ${column} END`);
      memberValues.push(sourceMember[column] || targetMember[column] || null);
    }
  });

  memberValues.push(targetMember.id);
  db.prepare(`UPDATE Member SET ${memberSets.join(', ')} WHERE id=?`).run(...memberValues);
}

function mergeMemberIntoTarget(db: AdminDb, sourceMember: MemberRow, targetMember: MemberRow, phone: string, sourceLabel: string) {
  const sourceId = Number(sourceMember.id);
  const targetId = Number(targetMember.id);
  if (!sourceId || !targetId || sourceId === targetId) return getMember(db, targetId) || targetMember;
  const identity = mergeIdentity(targetMember, sourceMember, phone);

  return db.transaction(() => {
    moveWechatIdentities(db, targetId, sourceId);
    cancelMergedPhoneMember(db, sourceId, targetId);
    updateTargetMemberFromMerge(db, targetMember, sourceMember, identity, sourceLabel);

    mergeCourseSeriesVisit(db, sourceId, targetId, identity);
    mergeVideoProgress(db, sourceId, targetId, identity);
    [
      'CourseSeriesVisitLog',
      'CourseAuthorization',
      'StudyNote',
      'VideoBookmark',
      'Question',
      'Answer',
      'PracticeCheckin',
      'Certificate',
      'CourseOrder',
      'CommissionRecord',
      'DistributionRelation',
      'MemberBadge',
      'orders',
      'shop_sales',
    ].forEach(table => {
      if (tableExists(db, table)) reassignSimpleMemberIdRows(db, table, sourceId, targetId, identity);
    });
    ['Payment', 'ConsumeRecord', 'FinanceIncome', 'FinanceOrder'].forEach(table => {
      if (tableExists(db, table) && tableColumns(db, table).has('memberId')) {
        db.prepare(`UPDATE ${table} SET memberId=? WHERE memberId=?`).run(targetId, sourceId);
      }
    });
    return getMember(db, targetId) || targetMember;
  })();
}

function mergePhoneMemberIntoWechatMember(db: AdminDb, phoneMember: MemberRow, wechatMember: MemberRow, phone: string) {
  return mergeMemberIntoTarget(db, phoneMember, wechatMember, phone, 'wechat_phone');
}

/** Both login identities must already be verified within the caller's write transaction. */
export function mergeConfirmedProfilePhone(db: AdminDb, source: MemberRow, target: MemberRow, phone: string) {
  const sourceId = Number(source.id), targetId = Number(target.id);
  if (tableExists(db, 'MemberBadge')) {
    db.prepare(`DELETE FROM MemberBadge WHERE member_id=? AND badge_id IN
      (SELECT badge_id FROM MemberBadge WHERE member_id=?)`).run(sourceId, targetId);
  }
  const merged = mergeMemberIntoTarget(db, source, target, phone, 'mini_profile_phone');
  const ownership = [
    ['event_players', 'member_id'], ['event_players', 'submitted_by_member_id'], ['event_judges', 'member_id'],
    ['event_registration_batches', 'member_id'], ['shop_online_orders', 'member_id'], ['shop_course_orders', 'member_id'],
    ['OfflineEnrollment', 'member_id'], ['OfflineEntitlement', 'member_id'], ['OfflineBooking', 'member_id'],
    ['OfflineAttendance', 'member_id'], ['exclusive_orders', 'bound_member_id'], ['exclusive_claims', 'member_id'],
  ];
  for (const [table, column] of ownership) {
    if (tableColumns(db, table).has(column)) db.prepare(`UPDATE ${table} SET ${column}=? WHERE ${column}=?`).run(targetId, sourceId);
  }
  if (tableExists(db, 'MemberDeviceSession')) {
    db.prepare("UPDATE MemberDeviceSession SET revoked_at_ms=?, revoke_reason='account_merged' WHERE member_id=? AND revoked_at_ms=0")
      .run(Date.now(), sourceId);
  }
  db.prepare('UPDATE Member SET mini_login_retired=1 WHERE id=?').run(sourceId);
  return merged;
}

/** Only called after an authenticated platform administrator explicitly confirms
 * the current candidate set. A registration contact is not a verified login phone. */
export function mergeConfirmedEventMembers(db: AdminDb, targetId: number, sourceIds: number[], importedName: string) {
  if ((db as any).eventOwnerId || !(db as any).eventCanMergeMembers) throw new Error('当前账号不能合并全局人员档案，请联系平台管理员');
  const name = cleanText(importedName);
  if (!name || name.length > 120) throw new Error('请填写1至120个字符的选手姓名');
  return db.transaction(() => {
    let target = getMember(db, targetId);
    if (!target || target.status === 'deleted' || target.merged_to_member_id) throw new Error('人员档案已变化，请重新核对');
    for (const sourceId of sourceIds) {
      const source = getMember(db, sourceId);
      if (!source || source.status === 'deleted' || source.merged_to_member_id || sourceId === targetId) throw new Error('人员档案已变化，请重新核对');
      const sameUnion = target.wx_unionid && target.wx_unionid === source.wx_unionid;
      if ((target.wx_unionid && source.wx_unionid && target.wx_unionid !== source.wx_unionid)
        || (target.wx_openid && source.wx_openid && target.wx_openid !== source.wx_openid && !sameUnion)) {
        throw new Error('档案绑定了不同微信身份，不能在导入时合并，请先核实身份');
      }
      db.exec(`CREATE TABLE IF NOT EXISTS EventMemberMergeAudit (
        id INTEGER PRIMARY KEY, actor_id INTEGER NOT NULL, target_id INTEGER NOT NULL, source_id INTEGER NOT NULL,
        before_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);
      const snapshot = (m: MemberRow) => Object.fromEntries(['id', 'name', 'phone', 'phone_country_code', 'phone_national_number', 'status', 'merged_to_member_id'].map(key => [key, m[key] ?? null]));
      db.prepare('INSERT INTO EventMemberMergeAudit(actor_id,target_id,source_id,before_json) VALUES(?,?,?,?)')
        .run(Number((db as any).eventActorId || 0), targetId, sourceId, JSON.stringify({ target: snapshot(target), source: snapshot(source), importedName: name }));
      const phoneFields = ['phone', 'phone_country_code', 'phone_national_number'].filter(key => tableColumns(db, 'Member').has(key));
      const profilePhone = Object.fromEntries(phoneFields.map(key => [key, target![key] || source[key] || null]));
      target = mergeMemberIntoTarget(db, source, target, '', 'event_import_confirmed');
      // The login merge helper also fills phone fields; do not infer a country or
      // login identity from an event contact (notably Malaysian local numbers).
      if (phoneFields.length) db.prepare(`UPDATE Member SET ${phoneFields.map(key => `${key}=?`).join(',')} WHERE id=?`)
        .run(...phoneFields.map(key => profilePhone[key]), targetId);
      for (const table of ['event_players', 'event_judges', 'event_registration_batches', 'event_notices',
        'OfflineEnrollment', 'OfflineEntitlement', 'OfflineBooking', 'OfflineAttendance', 'OfflineCheckinToken',
        'shop_online_orders', 'shop_course_orders']) {
        const cols = tableColumns(db, table);
        // Keep historical contact, payment and scoring fields exactly as recorded.
        for (const column of ['member_id', 'submitted_by_member_id']) if (cols.has(column)) {
          db.prepare(`UPDATE ${table} SET ${column}=? WHERE ${column}=?`).run(targetId, sourceId);
        }
      }
      target = getMember(db, targetId)!;
    }
    // Explicitly confirmed imports use the supplied name as the primary name.
    // This shares the import transaction, so a failed registration restores it.
    db.prepare('UPDATE Member SET name=? WHERE id=?').run(name, targetId);
    return targetId;
  })();
}

function transferWechatIdentity(db: AdminDb, target: MemberRow, source: MemberRow | null) {
  if (!source || !target || Number(source.id) === Number(target.id)) return;

  const sourceOpenid = cleanText(source.wx_openid);
  const sourceUnionid = cleanText(source.wx_unionid);
  const sourceSessionKey = cleanText(source.wx_session_key);
  const sourceNickname = cleanText(source.wx_nickname);
  const sourceAvatar = cleanText(source.wx_avatar_url);
  const sourceSyncedAt = cleanText(source.wx_profile_synced_at);
  const sourceSessionAt = cleanText(source.wx_session_updated_at);

  if (!cleanText(target.wx_openid) && sourceOpenid) {
    db.prepare(
      `UPDATE Member
       SET wx_openid='', wx_session_key='', wx_session_updated_at=NULL
       WHERE id=?`
    ).run(source.id);
  }

  db.prepare(
    `UPDATE Member
     SET wx_openid=CASE WHEN COALESCE(wx_openid,'')='' THEN ? ELSE wx_openid END,
         wx_unionid=CASE WHEN COALESCE(wx_unionid,'')='' THEN ? ELSE wx_unionid END,
         wx_session_key=CASE WHEN COALESCE(wx_session_key,'')='' THEN ? ELSE wx_session_key END,
         wx_session_updated_at=CASE WHEN wx_session_updated_at IS NULL THEN ? ELSE wx_session_updated_at END,
         wx_nickname=CASE WHEN COALESCE(wx_nickname,'')='' THEN ? ELSE wx_nickname END,
         wx_avatar_url=CASE WHEN COALESCE(wx_avatar_url,'')='' THEN ? ELSE wx_avatar_url END,
         wx_profile_synced_at=CASE WHEN wx_profile_synced_at IS NULL THEN ? ELSE wx_profile_synced_at END
     WHERE id=?`
  ).run(
    sourceOpenid,
    sourceUnionid,
    sourceSessionKey,
    sourceSessionAt || null,
    sourceNickname,
    sourceAvatar,
    sourceSyncedAt || null,
    target.id,
  );
}

export function serializeMember(member: MemberRow) {
  return {
    id: member.id,
    name: member.name,
    phone: formatMemberPhoneForDisplay(member.phone, member.phone_country_code),
    avatar_url: member.wx_avatar_url || member.avatar_url || '',
    wx_avatar_url: member.wx_avatar_url || member.avatar_url || '',
    wx_nickname: member.wx_nickname || '',
    wx_openid: member.wx_openid || '',
    wx_unionid: member.wx_unionid || '',
    level: member.level || '',
    is_phone_bound: !!member.phone,
    is_wechat_bound: !!(member.wx_openid || member.wx_unionid || member.wx_nickname || member.wx_avatar_url),
  };
}

export function loginData(member: MemberRow) {
  return {
    token: memberToken(member),
    member: serializeMember(member),
  };
}

export function upsertPhoneMember(db: AdminDb, phone: string, options: { sourceMemberId?: unknown; source?: string } = {}) {
  const normalizedPhone = formatMemberPhoneForDisplay(phone);
  const sourceMember = canonicalMember(db, getMember(db, options.sourceMemberId));
  const matches = findPhoneMembers(db, phone);
  if (matches.length > 1) throw new Error('手机号关联多位学员，请联系客服核实');
  let phoneMember = (matches[0] as MemberRow | undefined) || null;
  phoneMember = canonicalMember(db, phoneMember);

  if (sourceMember && phoneMember && Number(phoneMember.id) !== Number(sourceMember.id)) {
    const sourceHasWechat = Boolean(cleanText(sourceMember.wx_openid) || cleanText(sourceMember.wx_unionid));
    const phoneHasWechat = Boolean(cleanText(phoneMember.wx_openid) || cleanText(phoneMember.wx_unionid));
    if (sourceHasWechat || !phoneHasWechat) {
      return mergePhoneMemberIntoWechatMember(db, phoneMember, sourceMember, normalizedPhone);
    }
    return mergeMemberIntoTarget(db, sourceMember, phoneMember, normalizedPhone, options.source || 'mini_program');
  }

  if (phoneMember) {
    if (sourceMember && Number(sourceMember.id) !== Number(phoneMember.id)) {
      return mergeMemberIntoTarget(db, sourceMember, phoneMember, normalizedPhone, options.source || 'mini_program');
    }
    return getMember(db, phoneMember.id) || phoneMember;
  }

  if (sourceMember && !cleanText(sourceMember.phone)) {
    const nextName = generatedWechatName(sourceMember.name)
      ? fallbackPhoneName(normalizedPhone)
      : cleanText(sourceMember.name, fallbackPhoneName(normalizedPhone));
    db.prepare(
      `UPDATE Member
       SET phone=?, name=?, source=?, status='active'
       WHERE id=?`
    ).run(normalizedPhone, nextName, options.source || 'mini_program', sourceMember.id);
    return getMember(db, sourceMember.id) || sourceMember;
  }

  if (sourceMember && (cleanText(sourceMember.wx_openid) || cleanText(sourceMember.wx_unionid))) {
    db.prepare(
      `UPDATE Member
       SET phone=?,
           source=?, status='active'
       WHERE id=?`
    ).run(normalizedPhone, options.source || 'mini_program', sourceMember.id);
    return getMember(db, sourceMember.id) || sourceMember;
  }

  if (sourceMember && samePhoneIdentity(sourceMember.phone, phone, sourceMember.phone_country_code)) {
    return getMember(db, sourceMember.id) || sourceMember;
  }

  const result = db.prepare(
    `INSERT INTO Member (name, phone, source, status, register_date, created_at)
     VALUES (?, ?, ?, 'active', date('now','localtime'), datetime('now','localtime'))`
  ).run(fallbackPhoneName(normalizedPhone), normalizedPhone, options.source || 'mini_program');

  const member = getMember(db, result.lastInsertRowid) as MemberRow;
  createWelcomeMessage(db, Number(member.id), cleanText(member.name));
  return member;
}
