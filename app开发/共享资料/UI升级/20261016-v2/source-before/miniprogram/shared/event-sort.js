// Latest scheduled events first; undated events come last.
function startTime(item) {
  const value = String(item.startDate || item.start_date || '').trim();
  const parsed = Date.parse(value);
  const time = Number.isFinite(parsed) ? parsed : Date.parse(value.replace(/-/g, '/'));
  return value && Number.isFinite(time) ? time : null;
}

function sortEventsNewestFirst(events) {
  return (Array.isArray(events) ? events : []).slice().sort((a, b) => {
    const left = startTime(a);
    const right = startTime(b);
    if (left === null && right !== null) return 1;
    if (left !== null && right === null) return -1;
    if (left !== right) return right - left;
    return Number(b.competitionId || b.id || 0) - Number(a.competitionId || a.id || 0);
  });
}

module.exports = { sortEventsNewestFirst };
