import { Row } from './Models';
export interface CalendarDay { key: string; day: number; outside: boolean; today: boolean; }
export interface CalendarSegment { key: number; row: Row; left: number; width: number; top: number; background: string; foreground: string; }
export interface CalendarWeek { key: number; height: number; days: CalendarDay[]; segments: CalendarSegment[]; }
interface CalendarPeriod { row: Row; index: number; start: number; end: number; }
const DAY: number = 86400000;
function dateValue(value: string | undefined): number {
  const text = (value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return NaN;
  const time = Date.parse(text + 'T00:00:00Z');
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === text ? time : NaN;
}
export function calendarWeeks(rows: Row[], monthTime: number): CalendarWeek[] {
  const month = new Date(monthTime), year = month.getUTCFullYear(), m = month.getUTCMonth();
  const first = Date.UTC(year, m, 1), end = Date.UTC(year, m + 1, 0), offset = (new Date(first).getUTCDay() + 6) % 7;
  const start = first - offset * DAY;
  const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
  const items: CalendarPeriod[] = [];
  rows.forEach((row: Row, index: number) => {
    const from = dateValue(row.start_date), to = dateValue(row.end_date || row.start_date);
    if (Number.isFinite(from) && Number.isFinite(to) && to >= from) items.push({ row: row, index: index, start: from, end: to });
  });
  items.sort((a: CalendarPeriod, b: CalendarPeriod) => a.start - b.start || b.end - a.end || a.index - b.index);
  const weeks: CalendarWeek[] = [];
  for (let w = 0; w < Math.ceil((offset + new Date(end).getUTCDate()) / 7); w++) {
    const weekStart = start + w * 7 * DAY, weekEnd = weekStart + 6 * DAY;
    const lanes: number[] = [], segments: CalendarSegment[] = [], days: CalendarDay[] = [];
    items.forEach((item: CalendarPeriod) => {
      if (item.start > weekEnd || item.end < weekStart) return;
      const left = Math.max(0, Math.round((item.start - weekStart) / DAY)), right = Math.min(6, Math.round((item.end - weekStart) / DAY));
      let lane = lanes.findIndex((until: number) => until < left); if (lane < 0) lane = lanes.length; lanes[lane] = right;
      const type = item.row.category || '';
      const index = /集训|bootcamp/.test(type) ? 0 : /传承|masterclass/.test(type) ? 1 : /认证|certification/.test(type) ? 2 : 3;
      const backgrounds: string[] = ['#f9dfe0', '#dcecd6', '#dce7f4', '#f4e7cc'];
      const foregrounds: string[] = ['#842e39', '#315c35', '#345575', '#745529'];
      segments.push({key:item.index,row:item.row,left:left/7*100,width:(right-left+1)/7*100,top:44+lane*36,background:backgrounds[index],foreground:foregrounds[index]});
    });
    for (let d=0; d<7; d++) { const day = new Date(weekStart + d*DAY); const key = day.toISOString().slice(0,10); days.push({key:key,day:day.getUTCDate(),outside:day.getUTCMonth()!==m,today:key===today}); }
    weeks.push({key:w,height:Math.max(116,52+lanes.length*36),days:days,segments:segments});
  }
  return weeks;
}
