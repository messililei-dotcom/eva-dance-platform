import { openAdminDb } from '@/lib/server/admin-db';

type Entry = { id: number; competition_id: number; member_id: number; name: string; phone: string };
/** Same per-event contestant identity as event-entry-summary. No names or IDs leave this helper. */
export function eventPlatformTotals(entries: Entry[], eventCount: number) {
  const people = new Set<string>();
  for (const entry of entries) {
    const phone = String(entry.phone || '').replace(/[\s-]/g, '').replace(/^\+?86(?=1\d{10}$)/, '');
    const member = Number(entry.member_id || 0);
    const key = member > 0 ? `member:${member}` : phone ? `person:${String(entry.name || '').trim().toLocaleLowerCase()}:${phone}` : `entry:${entry.id}`;
    people.add(`${entry.competition_id}:${key}`);
  }
  return { eventCount, participantCount: people.size, programCount: entries.length };
}
export function loadEventPlatformTotals() {
  const db = openAdminDb({ readonly: true });
  try {
    const entries = db.prepare(`SELECT p.id,p.competition_id,p.member_id,p.name,p.phone
      FROM event_players p JOIN event_competitions c ON c.id=p.competition_id
      WHERE c.status IN ('published','finished') AND p.audit_status!='rejected'
        AND p.status NOT IN ('withdrawn','cancelled')`).all<Entry>();
    const events = db.prepare("SELECT COUNT(*) AS total FROM event_competitions WHERE status IN ('published','finished')").get<{ total: number }>();
    return eventPlatformTotals(entries, Number(events?.total || 0));
  } finally { db.close(); }
}
