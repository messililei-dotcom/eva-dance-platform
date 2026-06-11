import type { AdminDb } from '@/lib/server/admin-db';
import { cleanText, memberToken } from './_helpers';

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
    phone: member.phone || '',
    avatar_url: member.wx_avatar_url || member.avatar_url || '',
    wx_avatar_url: member.wx_avatar_url || member.avatar_url || '',
    wx_nickname: member.wx_nickname || '',
    wx_openid: member.wx_openid || '',
    wx_unionid: member.wx_unionid || '',
    level: member.level || '',
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
  const sourceMember = getMember(db, options.sourceMemberId);
  let phoneMember = db.prepare('SELECT * FROM Member WHERE phone=?').get<MemberRow>(phone) || null;

  if (phoneMember) {
    transferWechatIdentity(db, phoneMember, sourceMember);
    return getMember(db, phoneMember.id) || phoneMember;
  }

  if (sourceMember && !cleanText(sourceMember.phone)) {
    const nextName = generatedWechatName(sourceMember.name)
      ? fallbackPhoneName(phone)
      : cleanText(sourceMember.name, fallbackPhoneName(phone));
    db.prepare(
      `UPDATE Member
       SET phone=?, name=?, source=?, status='active'
       WHERE id=?`
    ).run(phone, nextName, options.source || 'mini_program', sourceMember.id);
    return getMember(db, sourceMember.id) || sourceMember;
  }

  const result = db.prepare(
    `INSERT INTO Member (name, phone, source, status, register_date, created_at)
     VALUES (?, ?, ?, 'active', date('now','localtime'), datetime('now','localtime'))`
  ).run(fallbackPhoneName(phone), phone, options.source || 'mini_program');

  return getMember(db, result.lastInsertRowid) as MemberRow;
}
