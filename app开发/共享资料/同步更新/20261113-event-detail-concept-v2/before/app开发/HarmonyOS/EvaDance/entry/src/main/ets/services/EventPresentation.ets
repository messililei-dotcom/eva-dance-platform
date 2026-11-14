import { Row } from './Models';

export function eventCount(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? String(value) : '未公开';
}
export function eventAggregate(rows: Row[], people: boolean): string {
  let total = 0;
  for (const row of rows) {
    const value = people ? (row.approvedPlayerCount ?? row.playerCount) : (row.rankingCount ?? row.scoreCount);
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || !Number.isSafeInteger(total + value)) return people ? '未公开' : '—';
    total += value;
  }
  return String(total);
}
export function eventDates(row: Row): string {
  const start = (row.startDate || row.start_date || '').slice(0, 10), end = (row.endDate || row.end_date || '').slice(0, 10);
  return !start ? '时间待定' : !end || start === end ? start : start + ' 至 ' + end;
}
function eventTime(value: string | undefined, end: boolean): number | undefined {
  if (!value) return undefined;
  const local = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(value);
  const time = Date.parse(value.length === 10 ? value + (end ? 'T23:59:59.999+08:00' : 'T00:00:00+08:00') : local ? value.replace(' ', 'T') + '+08:00' : value);
  return Number.isFinite(time) ? time : undefined;
}
export function eventState(row: Row, now: number = Date.now()): string {
  if (row.status === 'cancelled') return '已取消';
  const finish = eventTime(row.endDate || row.end_date, true);
  if (row.status === 'finished' || (finish !== undefined && finish < now)) return '已结束';
  const start = eventTime(row.registrationStart, false), end = eventTime(row.registrationEnd, true);
  if (start !== undefined && start > now) return '报名未开始';
  if (end !== undefined && end < now) return '报名已截止';
  return row.registrationStatus === 'open' ? '报名中' : '报名未开放';
}
