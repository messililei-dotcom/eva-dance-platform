import { createInboxMessage, ensureInboxSchema } from './inbox';
import { normalizeEventMemberPhone } from './event-member-sync';

/** Recipients come exclusively from this competition; never accept client member IDs. */
export function eventNoticeAudience(db: any, competitionId: number) {
  const competition = db.prepare('SELECT id,name,start_date FROM event_competitions WHERE id=?').get(competitionId);
  if (!competition) throw new Error('赛事不存在或无权限查看');
  const people = db.prepare(`SELECT member_id,name,phone,'player' AS role FROM event_players WHERE competition_id=?
    UNION ALL SELECT j.member_id,j.name,j.phone,'judge' FROM main.event_judges j
    WHERE EXISTS (SELECT 1 FROM event_group_judges gj WHERE gj.judge_id=j.id AND gj.competition_id=?)`).all(competitionId, competitionId);
  const members: any[] = db.prepare('SELECT * FROM main.Member').all();
  const byId = new Map<number, any>(members.map(m => [Number(m.id), m]));
  const canonical = (id: number) => {
    const seen = new Set<number>(); let member = byId.get(id);
    while (member?.merged_to_member_id && !seen.has(Number(member.id))) {
      seen.add(Number(member.id)); member = byId.get(Number(member.merged_to_member_id));
    }
    return member && !seen.has(Number(member.id)) && member.status !== 'deleted' ? Number(member.id) : 0;
  };
  const ids = new Set<number>(), roleIds = { player: new Set<number>(), judge: new Set<number>() };
  const missing = new Set<string>();
  for (const person of people) {
    let id = canonical(Number(person.member_id));
    if (!id) {
      const phone = normalizeEventMemberPhone(person.phone), name = String(person.name || '').trim().toLocaleLowerCase();
      const matches = phone && name ? members.filter(m => String(m.name || '').trim().toLocaleLowerCase() === name &&
        [m.phone,m.phone_national_number].some(p => normalizeEventMemberPhone(p) === phone)).map(m => canonical(Number(m.id))).filter(Boolean) : [];
      const unique = [...new Set(matches)]; if (unique.length === 1) id = unique[0];
    }
    if (id) { ids.add(id); roleIds[person.role as 'player' | 'judge'].add(id); }
    else missing.add(`${person.role}:${String(person.name).trim()}:${normalizeEventMemberPhone(person.phone)}`);
  }
  return { competition, memberIds: [...ids].sort((a,b) => a-b), recipients: ids.size,
    players: roleIds.player.size, judges: roleIds.judge.size, unmatched: missing.size };
}

export function publishEventNotice(db: any, competitionId: number, input: {title: string; content: string; requestKey: string}) {
  return db.transaction(() => {
    const audience = eventNoticeAudience(db, competitionId);
    ensureInboxSchema(db);
    const key = `event-notice:${competitionId}:${input.requestKey}`;
    const existing = db.prepare('SELECT id,title,content,payload_json FROM InboxMessage WHERE dedupe_key=?').get(key);
    if (existing) {
      if (existing.title !== input.title || existing.content !== input.content) throw new Error('该通知已发送，请重新打开发布窗口');
      return { messageId: existing.id, recipients: Number(db.prepare('SELECT COUNT(*) AS count FROM InboxRecipient WHERE message_id=?').get(existing.id).count), created: false };
    }
    if (!audience.recipients) throw new Error('本赛事暂无可接收站内通知的用户');
    const result = createInboxMessage(db, { type: 'event', title: input.title, content: input.content,
      actionUrl: `/events/event-${String(audience.competition.start_date || '').slice(0,4) || 'event'}-${competitionId}`, businessType: 'event_notice', businessId: competitionId,
      dedupeKey: key, priority: 'important', memberIds: audience.memberIds,
      payload: { competitionId, competitionName: audience.competition.name, unmatched: audience.unmatched } });
    return { ...result, unmatched: audience.unmatched };
  })();
}
