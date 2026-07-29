type MemberLike = Record<string, any>;

function text(value: unknown) {
  return value === undefined || value === null ? '' : String(value).trim();
}

export function getMemberIdentity(member: MemberLike) {
  const raw = member?.raw || {};
  const id = text(member?.id ?? member?.memberId ?? member?.member_id ?? raw?.id ?? raw?.memberId ?? raw?.member_id);
  const name = text(member?.name ?? member?.memberName ?? raw?.name ?? raw?.memberName);
  const phone = text(member?.phone ?? member?.memberPhone ?? raw?.phone ?? raw?.memberPhone);
  const wxOpenid = text(member?.wxOpenid ?? member?.wx_openid ?? raw?.wxOpenid ?? raw?.wx_openid);
  const wxUnionid = text(member?.wxUnionid ?? member?.wx_unionid ?? raw?.wxUnionid ?? raw?.wx_unionid);
  const wxName = text(member?.wxName ?? member?.wx_name ?? raw?.wxName ?? raw?.wx_name);
  const wxAccount = text(member?.wxAccount ?? member?.wx_account ?? raw?.wxAccount ?? raw?.wx_account);
  const wxNickname = text(member?.wxNickname ?? member?.wx_nickname ?? raw?.wxNickname ?? raw?.wx_nickname);
  return { id, name, phone, wxOpenid, wxUnionid, wxName, wxAccount, wxNickname };
}

export function shortWxId(value: unknown) {
  const id = text(value);
  if (id.length <= 16) return id;
  return `${id.slice(0, 8)}...${id.slice(-4)}`;
}

export function memberSearchText(member: MemberLike) {
  const identity = getMemberIdentity(member);
  const raw = member?.raw || {};
  const eventStudent = text(raw.source ?? member?.source) === 'event_competition'
    || text(raw.remark ?? member?.remark).includes('赛事参赛学员');
  return [
    identity.name,
    identity.phone,
    identity.id,
    identity.id ? `member:${identity.id}` : '',
    identity.id ? `member_id:${identity.id}` : '',
    identity.wxOpenid,
    identity.wxUnionid,
    identity.wxName,
    identity.wxAccount,
    identity.wxNickname,
    text(raw.source ?? member?.source),
    text(raw.remark ?? member?.remark),
    eventStudent ? '赛事学员 比赛学员 参赛学员' : '',
  ].filter(Boolean).join(' ').toLowerCase();
}

export function memberOptionLabel(member: MemberLike) {
  const identity = getMemberIdentity(member);
  return [
    identity.name || '未命名学员',
    identity.phone,
    identity.id ? `member_id:${identity.id}` : '',
    identity.wxOpenid ? `openid:${shortWxId(identity.wxOpenid)}` : '',
    identity.wxUnionid ? `unionid:${shortWxId(identity.wxUnionid)}` : '',
    identity.wxAccount ? `微信:${identity.wxAccount}` : '',
    !identity.wxAccount && identity.wxName ? `微信:${identity.wxName}` : '',
    !identity.wxAccount && !identity.wxName && identity.wxNickname ? `微信:${identity.wxNickname}` : '',
  ].filter(Boolean).join(' · ');
}
