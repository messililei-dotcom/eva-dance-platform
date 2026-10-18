// One display rule for the event list, detail and registration form.
// Submission is still authorized and priced by the server.
function eventState(event, now = Date.now()) {
  const time = value => value ? Date.parse(value) : null;
  const start = time(event.registrationStart);
  const end = time(event.registrationEnd);
  const eventEnd = time(event.endDate || event.end_date);
  const finished = event.status === 'finished' || (eventEnd !== null && eventEnd < now);
  const cancelled = event.status === 'cancelled';
  const registrationOpen = !finished && !cancelled && event.registrationStatus === 'open'
    && (start === null || start <= now) && (end === null || end >= now);
  const statusText = cancelled ? '已取消' : finished ? '已结束' : registrationOpen ? '报名中'
    : start !== null && start > now ? '报名未开始'
    : end !== null && end < now ? '报名已截止' : '报名未开放';
  return { finished, registrationOpen, statusText };
}
module.exports = { eventState };
