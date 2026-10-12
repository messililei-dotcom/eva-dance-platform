/** Number before filtering/pagination; one programme per registration, one contestant per person. */
export function eventEntrySummary(entries: any[]) {
  const chronological = [...entries].sort((a, b) => {
    const date = (value: any) => {
      const parsed = Date.parse(String(value.registeredAt || value.createdAt || '').replace(' ', 'T'));
      return Number.isFinite(parsed) ? parsed : 0;
    };
    return date(a) - date(b) || Number(a.id) - Number(b.id);
  });
  const people = new Map<string, any>();
  const players = chronological.map((entry, index) => {
    const phone = String(entry.phone || '').replace(/[\s-]/g, '').replace(/^\+?86(?=1\d{10}$)/, '');
    const memberId = Number(entry.memberId || 0);
    const key = memberId > 0 ? `member:${memberId}` : phone ? `person:${String(entry.name || '').trim().toLocaleLowerCase()}:${phone}` : `entry:${entry.id}`;
    let person = people.get(key);
    if (!person) {
      person = { ...entry, key, contestantNumber: `选手${String(people.size + 1).padStart(3, '0')}`, entries: [], totalRegistrationFee: 0 };
      people.set(key, person);
    }
    const player = { ...entry, contestantNumber: person.contestantNumber, programNumber: `节目${String(index + 1).padStart(3, '0')}` };
    person.entries.push(player);
    // Sum registration snapshots in cents, including unpaid/refunded registrations.
    person.totalRegistrationFee = (Math.round(person.totalRegistrationFee * 100) + Math.round(Number(entry.registrationFee || 0) * 100)) / 100;
    return player;
  });
  return { players, contestants: [...people.values()] };
}
