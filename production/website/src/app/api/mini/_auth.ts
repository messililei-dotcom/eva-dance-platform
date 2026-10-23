import type { AdminDb } from '@/lib/server/admin-db';
import { cleanText, memberToken } from './_helpers';
import { moveWechatIdentities } from '@/lib/server/wechat-identity';

type MemberRow = Record<string, any> & { id: unknown; phone?: unknown };

function generatedWechatName(name: unknown) {
  return /^微信学员[A-Za-z0-9_-]{4,}$/.test(cleanText(name));
}

function fallbackPhoneName(phone: string) {
  return `手机学员${phone.slice(-4)}`;
}

function getMember(db: AdminDb, id: unknown) {
  const memberId = Number(id);
  if (!Number.isInteger(memberId) || memberId <= 0) return null;
  return db.prepare('SELECT * FROM Member WHERE id=?').get<MemberRow>(memberId) || null;
}

function tableExists(db: AdminDb, table: string) {
  return Boolean(db.prepare(
    "SELECT 1 FROM sqlite_master WHERE type='table' AND name=? LIMIT 1"
  ).get(table));
}

function updateMemberReferences(db: AdminDb, table: string, targetId: number, sourceId: number) {
  if (!tableExists(db, table)) return;
  db.prepare(`UPDATE ${table} SET member_id=? WHERE member_id=?`).run(targetId, sourceId);
}

export function mergeMemberAccounts(db: AdminDb, targetIdValue: unknown, sourceIdValue: unknown) {
  const targetId = Number(targetIdValue);
  const sourceId = Number(sourceIdValue);
  if (!Number.isInteger(targetId) || targetId <= 0 || !Number.isInteger(sourceId) || sourceId <= 0) {
    throw new Error('待合并的学员账号无效');
  }
  if (targetId === sourceId) return getMember(db, targetId);
  const target = getMember(db, targetId);
  const source = getMember(db, sourceId);
  if (!target || !source) throw new Error('待合并的学员账号不存在');

  const targetOpenid = cleanText(target.wx_openid);
  const sourceOpenid = cleanText(source.wx_openid);
  const targetUnionid = cleanText(target.wx_unionid);
  const sourceUnionid = cleanText(source.wx_unionid);
  if (
    (targetUnionid && sourceUnionid && targetUnionid !== sourceUnionid)
    || (!targetUnionid && !sourceUnionid && targetOpenid && sourceOpenid && targetOpenid !== sourceOpenid)
  ) {
    throw new Error('该手机号已绑定其他微信，请联系客服核对后处理');
  }

  db.transaction(() => {
    // Tables with a composite unique key need collision-aware merging.
    if (tableExists(db, 'VideoProgress')) {
      db.prepare(
        `UPDATE VideoProgress AS target
         SET progress=MAX(target.progress, COALESCE((SELECT source.progress FROM VideoProgress source WHERE source.member_id=? AND source.video_id=target.video_id LIMIT 1), 0)),
             duration=MAX(target.duration, COALESCE((SELECT source.duration FROM VideoProgress source WHERE source.member_id=? AND source.video_id=target.video_id LIMIT 1), 0)),
             completed=MAX(target.completed, COALESCE((SELECT source.completed FROM VideoProgress source WHERE source.member_id=? AND source.video_id=target.video_id LIMIT 1), 0)),
             last_play_at=MAX(target.last_play_at, COALESCE((SELECT source.last_play_at FROM VideoProgress source WHERE source.member_id=? AND source.video_id=target.video_id LIMIT 1), target.last_play_at))
         WHERE target.member_id=? AND EXISTS (
           SELECT 1 FROM VideoProgress source WHERE source.member_id=? AND source.video_id=target.video_id
         )`
      ).run(sourceId, sourceId, sourceId, sourceId, targetId, sourceId);
      db.prepare(
        `DELETE FROM VideoProgress
         WHERE member_id=? AND EXISTS (
           SELECT 1 FROM VideoProgress target WHERE target.member_id=? AND target.video_id=VideoProgress.video_id
         )`
      ).run(sourceId, targetId);
      db.prepare(
        `UPDATE VideoProgress
         SET member_id=?, phone=?, wx_openid=?, wx_unionid=?, wx_name=?
         WHERE member_id=?`
      ).run(
        targetId,
        cleanText(target.phone || source.phone),
        targetOpenid || sourceOpenid,
        targetUnionid || sourceUnionid,
        cleanText(target.wx_name || target.wx_nickname || source.wx_name || source.wx_nickname),
        sourceId,
      );
    }

    if (tableExists(db, 'CourseSeriesVisit')) {
      db.prepare(
        `UPDATE CourseSeriesVisit AS target
         SET visit_count=target.visit_count + COALESCE((SELECT source.visit_count FROM CourseSeriesVisit source WHERE source.member_id=? AND source.series_id=target.series_id LIMIT 1), 0),
             first_visited_at=MIN(target.first_visited_at, COALESCE((SELECT source.first_visited_at FROM CourseSeriesVisit source WHERE source.member_id=? AND source.series_id=target.series_id LIMIT 1), target.first_visited_at)),
             last_visited_at=MAX(target.last_visited_at, COALESCE((SELECT source.last_visited_at FROM CourseSeriesVisit source WHERE source.member_id=? AND source.series_id=target.series_id LIMIT 1), target.last_visited_at))
         WHERE target.member_id=? AND EXISTS (
           SELECT 1 FROM CourseSeriesVisit source WHERE source.member_id=? AND source.series_id=target.series_id
         )`
      ).run(sourceId, sourceId, sourceId, targetId, sourceId);
      db.prepare(
        `DELETE FROM CourseSeriesVisit
         WHERE member_id=? AND EXISTS (
           SELECT 1 FROM CourseSeriesVisit target WHERE target.member_id=? AND target.series_id=CourseSeriesVisit.series_id
         )`
      ).run(sourceId, targetId);
      db.prepare('UPDATE CourseSeriesVisit SET member_id=? WHERE member_id=?').run(targetId, sourceId);
    }

    if (tableExists(db, 'MemberBadge')) {
      db.prepare(
        `DELETE FROM MemberBadge
         WHERE member_id=? AND EXISTS (
           SELECT 1 FROM MemberBadge target
           WHERE target.member_id=? AND target.badge_id=MemberBadge.badge_id
         )`
      ).run(sourceId, targetId);
      updateMemberReferences(db, 'MemberBadge', targetId, sourceId);
    }

    if (tableExists(db, 'PracticeCheckin')) {
      db.prepare(
        `UPDATE PracticeCheckin AS target
         SET remark=TRIM(COALESCE(target.remark,'') ||
               CASE WHEN COALESCE((SELECT source.remark FROM PracticeCheckin source WHERE source.member_id=? AND source.checkin_date=target.checkin_date LIMIT 1),'')<>''
                    THEN CASE WHEN COALESCE(target.remark,'')<>'' THEN ' / ' ELSE '' END ||
                         (SELECT source.remark FROM PracticeCheckin source WHERE source.member_id=? AND source.checkin_date=target.checkin_date LIMIT 1)
                    ELSE '' END),
             submission_url=CASE WHEN COALESCE(target.submission_url,'')='' THEN COALESCE((SELECT source.submission_url FROM PracticeCheckin source WHERE source.member_id=? AND source.checkin_date=target.checkin_date LIMIT 1),'') ELSE target.submission_url END,
             submission_type=CASE WHEN COALESCE(target.submission_type,'')='' THEN COALESCE((SELECT source.submission_type FROM PracticeCheckin source WHERE source.member_id=? AND source.checkin_date=target.checkin_date LIMIT 1),'text') ELSE target.submission_type END,
             series_id=CASE WHEN COALESCE(target.series_id,0)=0 THEN COALESCE((SELECT source.series_id FROM PracticeCheckin source WHERE source.member_id=? AND source.checkin_date=target.checkin_date LIMIT 1),0) ELSE target.series_id END
         WHERE target.member_id=? AND EXISTS (
           SELECT 1 FROM PracticeCheckin source WHERE source.member_id=? AND source.checkin_date=target.checkin_date
         )`
      ).run(sourceId, sourceId, sourceId, sourceId, sourceId, targetId, sourceId);
      db.prepare(
        `DELETE FROM PracticeCheckin
         WHERE member_id=? AND EXISTS (
           SELECT 1 FROM PracticeCheckin target
           WHERE target.member_id=? AND target.checkin_date=PracticeCheckin.checkin_date
         )`
      ).run(sourceId, targetId);
      updateMemberReferences(db, 'PracticeCheckin', targetId, sourceId);
    }

    if (tableExists(db, 'DistributionRelation')) {
      const targetRelation = db.prepare('SELECT id FROM DistributionRelation WHERE member_id=?').get(targetId);
      if (targetRelation) {
        db.prepare(
          `UPDATE DistributionRelation AS target
           SET parent_id=COALESCE(target.parent_id, (SELECT source.parent_id FROM DistributionRelation source WHERE source.member_id=? LIMIT 1)),
               grandparent_id=COALESCE(target.grandparent_id, (SELECT source.grandparent_id FROM DistributionRelation source WHERE source.member_id=? LIMIT 1))
           WHERE target.member_id=?`
        ).run(sourceId, sourceId, targetId);
        db.prepare('DELETE FROM DistributionRelation WHERE member_id=?').run(sourceId);
      }
      else db.prepare('UPDATE DistributionRelation SET member_id=? WHERE member_id=?').run(targetId, sourceId);
      db.prepare('UPDATE DistributionRelation SET parent_id=? WHERE parent_id=?').run(targetId, sourceId);
      db.prepare('UPDATE DistributionRelation SET grandparent_id=? WHERE grandparent_id=?').run(targetId, sourceId);
    }

    for (const table of [
      'Answer',
      'Certificate',
      'CommissionRecord',
      'CourseAuthorization',
      'CourseOrder',
      'CourseSeriesVisitLog',
      'Question',
      'StudyNote',
      'VideoBookmark',
      'event_judges',
      'event_players',
      'orders',
      'shop_sales',
    ]) {
      updateMemberReferences(db, table, targetId, sourceId);
    }

    const nextPhone = cleanText(target.phone || source.phone);
    const nextOpenid = targetOpenid || sourceOpenid;
    const nextUnionid = targetUnionid || sourceUnionid;
    if (tableExists(db, 'CourseAuthorization')) {
      db.prepare(
        `UPDATE CourseAuthorization
         SET phone=CASE WHEN COALESCE(phone,'')='' THEN ? ELSE phone END,
             wx_openid=CASE WHEN COALESCE(wx_openid,'')='' THEN ? ELSE wx_openid END,
             wx_unionid=CASE WHEN COALESCE(wx_unionid,'')='' THEN ? ELSE wx_unionid END
         WHERE member_id=?`
      ).run(nextPhone, nextOpenid, nextUnionid, targetId);
    }

    if (tableExists(db, 'MemberDeviceSession')) {
      db.prepare(
        `UPDATE MemberDeviceSession
         SET revoked_at_ms=?, revoke_reason='account_merged'
         WHERE member_id IN (?, ?) AND revoked_at_ms=0`
      ).run(Date.now(), targetId, sourceId);
    }

    moveWechatIdentities(db, targetId, sourceId);

    // Release unique WeChat identifiers before assigning them to the
    // canonical account. All values needed for the transfer are held above.
    db.prepare(
      `UPDATE Member
       SET wx_openid='', wx_unionid='', wx_session_key=''
       WHERE id=?`
    ).run(sourceId);

    db.prepare(
      `UPDATE Member
       SET name=CASE WHEN COALESCE(name,'')='' OR name LIKE '手机学员%' OR name LIKE '微信学员%' THEN ? ELSE name END,
           phone=CASE WHEN COALESCE(phone,'')='' THEN ? ELSE phone END,
           wx_openid=CASE WHEN COALESCE(wx_openid,'')='' THEN ? ELSE wx_openid END,
           wx_unionid=CASE WHEN COALESCE(wx_unionid,'')='' THEN ? ELSE wx_unionid END,
           wx_session_key=CASE WHEN COALESCE(wx_session_key,'')='' THEN ? ELSE wx_session_key END,
           wx_session_updated_at=COALESCE(wx_session_updated_at, ?),
           wx_nickname=CASE WHEN COALESCE(wx_nickname,'')='' THEN ? ELSE wx_nickname END,
           wx_name=CASE WHEN COALESCE(wx_name,'')='' THEN ? ELSE wx_name END,
           wx_account=CASE WHEN COALESCE(wx_account,'')='' THEN ? ELSE wx_account END,
           avatar=CASE WHEN COALESCE(avatar,'')='' THEN ? ELSE avatar END,
           wx_avatar_url=CASE WHEN COALESCE(wx_avatar_url,'')='' THEN ? ELSE wx_avatar_url END,
           wx_profile_synced_at=COALESCE(wx_profile_synced_at, ?)
       WHERE id=?`
    ).run(
      cleanText(source.name, cleanText(target.name)),
      nextPhone,
      nextOpenid,
      nextUnionid,
      cleanText(target.wx_session_key || source.wx_session_key),
      target.wx_session_updated_at || source.wx_session_updated_at || null,
      cleanText(target.wx_nickname || source.wx_nickname),
      cleanText(target.wx_name || source.wx_name),
      cleanText(target.wx_account || source.wx_account),
      cleanText(target.avatar || source.avatar || source.wx_avatar_url),
      cleanText(target.wx_avatar_url || source.wx_avatar_url || source.avatar),
      target.wx_profile_synced_at || source.wx_profile_synced_at || null,
      targetId,
    );

    db.prepare(
      `UPDATE Member
       SET phone=NULL, wx_openid='', wx_unionid='', wx_session_key='',
           status='inactive',
           remark=TRIM(COALESCE(remark,'') || ' [merged_into:${targetId}]')
       WHERE id=?`
    ).run(sourceId);
  })();

  return getMember(db, targetId);
}

export function serializeMember(member: MemberRow) {
  const wxName = cleanText(member.wx_name || member.wx_nickname);
  return {
    id: member.id,
    name: member.name,
    phone: member.phone || '',
    avatar_url: member.wx_avatar_url || member.avatar || member.avatar_url || '',
    wx_avatar_url: member.wx_avatar_url || member.avatar || member.avatar_url || '',
    wx_nickname: wxName,
    wx_name: wxName,
    wx_account: member.wx_account || '',
    wx_openid: member.wx_openid || '',
    wx_unionid: member.wx_unionid || '',
    wx_profile_synced_at: member.wx_profile_synced_at || '',
    level: member.level || '',
    gender: member.gender || '',
    birthday: member.birthday || '',
    country: member.country || '',
    province: member.province || '',
    city: member.city || '',
    address: member.address || '',
    remark: member.remark || '',
    register_date: member.register_date || '',
    created_at: member.created_at || '',
    is_wechat_bound: !!(
      member.wx_openid
      || member.wx_unionid
      || member.wx_nickname
      || member.wx_name
      || member.wx_avatar_url
    ),
  };
}

export function loginData(member: MemberRow) {
  return {
    token: memberToken(member),
    member: serializeMember(member),
  };
}

export function upsertPhoneMember(db: AdminDb, phone: string, options: { sourceMemberId?: unknown; source?: string } = {}) {
  const sourceMember = getMember(db, options.sourceMemberId);
  let phoneMember = db.prepare('SELECT * FROM Member WHERE phone=?').get<MemberRow>(phone) || null;

  if (phoneMember) {
    if (sourceMember && Number(phoneMember.id) !== Number(sourceMember.id)) {
      return mergeMemberAccounts(db, phoneMember.id, sourceMember.id) || phoneMember;
    }
    return phoneMember;
  }

  if (sourceMember && !cleanText(sourceMember.phone)) {
    const nextName = generatedWechatName(sourceMember.name)
      ? fallbackPhoneName(phone)
      : cleanText(sourceMember.name, fallbackPhoneName(phone));
    db.prepare(
      `UPDATE Member
       SET phone=?, name=?, source=?, status='active'
       WHERE id=?`
    ).run(phone, nextName, options.source || 'website_phone', sourceMember.id);
    return getMember(db, sourceMember.id) || sourceMember;
  }

  const result = db.prepare(
    `INSERT INTO Member (name, phone, source, status, register_date, created_at)
     VALUES (?, ?, ?, 'active', date('now','localtime'), datetime('now','localtime'))`
  ).run(fallbackPhoneName(phone), phone, options.source || 'website_phone');

  return getMember(db, result.lastInsertRowid) as MemberRow;
}
