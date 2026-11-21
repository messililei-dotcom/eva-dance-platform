'use client';

import { useMemo, useRef, useState, type TouchEvent } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getPublicCourseName, type PublicCourseRecord } from '@/lib/course-match';

const DAY = 86400000;
const keyOf = (date: Date) => date.toISOString().slice(0, 10);
function parseDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && keyOf(date) === value.slice(0, 10) ? date : null;
}

interface CourseColorRange { courseKey: string; start: number; end: number; }
interface CourseTone { background: string; foreground: string; }

function monday(time: number): number {
  return time - ((new Date(time).getUTCDay() + 6) % 7) * DAY;
}

// Keep the assignment independent of the month being viewed.
function courseColors(items: CourseColorRange[]): Map<string, number> {
  const conflicts = new Map<string, Set<string>>();
  for (const item of items) conflicts.set(item.courseKey, new Set<string>());
  for (let i = 0; i < items.length; i++) {
    const item = items[i], last = monday(item.end);
    for (let j = i + 1; j < items.length; j++) {
      const other = items[j];
      if (monday(other.start) > last + 7 * DAY) break;
      if (item.courseKey === other.courseKey) continue;
      conflicts.get(item.courseKey)?.add(other.courseKey);
      conflicts.get(other.courseKey)?.add(item.courseKey);
    }
  }
  const order = Array.from(conflicts.keys()).sort((a: string, b: string): number =>
    (conflicts.get(b)?.size || 0) - (conflicts.get(a)?.size || 0) || (a < b ? -1 : a > b ? 1 : 0));
  const assigned = new Map<string, number>();
  for (const key of order) {
    const used = new Set<number>();
    conflicts.get(key)?.forEach((neighbor: string) => {
      const index = assigned.get(neighbor);
      if (index !== undefined) used.add(index);
    });
    let index = 0;
    while (used.has(index)) index++;
    assigned.set(key, index);
  }
  return assigned;
}

const TONES: CourseTone[] = [
  { background: '#f6e8cb', foreground: '#654717' },
  { background: '#dceafb', foreground: '#21496f' },
  { background: '#f8dfe5', foreground: '#77293a' },
  { background: '#e1edda', foreground: '#335732' },
  { background: '#ede4fa', foreground: '#543c75' },
  { background: '#d9eee9', foreground: '#225954' },
  { background: '#fae3d6', foreground: '#743e22' },
  { background: '#e7e9f3', foreground: '#414a6e' },
];
function courseTone(index: number): CourseTone {
  if (index < TONES.length) return TONES[index];
  const hue = Math.round(index * 137.508) % 360;
  return { background: `hsl(${hue}, 58%, 88%)`, foreground: `hsl(${hue}, 52%, 26%)` };
}

export default function OfflineMonthCalendar({ courses, loading }: { courses: PublicCourseRecord[]; loading: boolean }) {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
  });
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const schedule = useMemo(() => courses.flatMap((course, index) => {
    const start = parseDate(course.startDate);
    const end = parseDate(course.endDate || course.startDate);
    return start && end && end >= start ? [{ course, index, courseKey: (course.officialMatchKey || course.name || String(course.id)).trim().replace(/\s+/g, ' ').toLowerCase(), start: start.getTime(), end: end.getTime() }] : [];
  }).sort((a, b) => a.start - b.start || b.end - a.end || a.index - b.index), [courses]);
  const colors = useMemo(() => courseColors(schedule), [schedule]);
  const first = new Date(month);
  first.setUTCDate(1 - (month.getUTCDay() + 6) % 7);
  const last = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0));
  const weeks = Math.ceil(((month.getUTCDay() + 6) % 7 + last.getUTCDate()) / 7);
  const monthEnd = last.getTime();
  const count = schedule.filter(item => item.start <= monthEnd && item.end >= month.getTime()).length;
  function move(offset: number) {
    setMonth(current => new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + offset, 1)));
  }
  const gesture = useRef<{ x: number; y: number; axis: 'horizontal' | 'vertical' | null } | null>(null);
  const suppressClickUntil = useRef(0);
  function startSwipe(event: TouchEvent<HTMLElement>) {
    suppressClickUntil.current = 0;
    gesture.current = event.touches.length === 1
      ? { x: event.touches[0].clientX, y: event.touches[0].clientY, axis: null }
      : null;
  }
  function trackSwipe(event: TouchEvent<HTMLElement>) {
    const start = gesture.current;
    if (!start || event.touches.length !== 1) { gesture.current = null; return; }
    const dx = Math.abs(event.touches[0].clientX - start.x);
    const dy = Math.abs(event.touches[0].clientY - start.y);
    if (!start.axis && Math.max(dx, dy) > 10) start.axis = dx > dy * 1.5 ? 'horizontal' : 'vertical';
    if (start.axis === 'horizontal') event.stopPropagation();
  }
  function endSwipe(event: TouchEvent<HTMLElement>) {
    const start = gesture.current;
    gesture.current = null;
    if (!start || event.touches.length || event.changedTouches.length !== 1 || start.axis === 'vertical') return;
    const dx = event.changedTouches[0].clientX - start.x;
    const dy = event.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) < 48 || Math.abs(dx) <= Math.abs(dy) * 1.5) return;
    event.stopPropagation();
    suppressClickUntil.current = Date.now() + 500;
    move(dx < 0 ? 1 : -1);
  }
  const focus = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crimson';

  return <section aria-label="线下课程月历" aria-busy={loading} className="overflow-hidden rounded-xl border border-[#e8ddcb] bg-white">
    <div className="flex items-center justify-between gap-1 px-2.5 py-1">
      <h2 aria-live="polite" className="whitespace-nowrap text-lg font-semibold tabular-nums text-text">{month.getUTCFullYear()}年{month.getUTCMonth() + 1}月</h2>
      <div className="flex shrink-0 items-center">
        <button type="button" aria-label="上个月" onClick={() => move(-1)} className={`flex h-11 w-11 items-center justify-center rounded-lg hover:bg-sand ${focus}`}><ChevronLeft size={20} /></button>
        <button type="button" onClick={() => { const now = new Date(); setMonth(new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1))); }} className={`h-11 rounded-lg px-3 text-sm text-crimson hover:bg-sand ${focus}`}>本月</button>
        <button type="button" aria-label="下个月" onClick={() => move(1)} className={`flex h-11 w-11 items-center justify-center rounded-lg hover:bg-sand ${focus}`}><ChevronRight size={20} /></button>
      </div>
    </div>
    <div
      data-history-swipe="ignore"
      style={{ touchAction: 'pan-y pinch-zoom' }}
      onTouchStart={startSwipe}
      onTouchMove={trackSwipe}
      onTouchEnd={endSwipe}
      onTouchCancel={() => { gesture.current = null; }}
      onClickCapture={event => {
        if (Date.now() < suppressClickUntil.current) { event.preventDefault(); event.stopPropagation(); }
      }}
    >
    <div className="grid grid-cols-7 border-y border-[#eee7dc] bg-[#faf7f1] py-2 text-center text-xs font-medium text-text-secondary">
      {['一', '二', '三', '四', '五', '六', '日'].map(day => <div key={day}>周{day}</div>)}
    </div>
    {Array.from({ length: weeks }, (_, week) => {
      const weekStart = first.getTime() + week * 7 * DAY;
      const weekEnd = weekStart + 6 * DAY;
      const lanes: number[] = [];
      const segments = schedule.filter(item => item.start <= weekEnd && item.end >= weekStart).map(item => {
        const start = Math.max(0, Math.round((item.start - weekStart) / DAY));
        const end = Math.min(6, Math.round((item.end - weekStart) / DAY));
        let lane = lanes.findIndex(occupiedUntil => occupiedUntil < start);
        if (lane < 0) lane = lanes.length;
        lanes[lane] = end;
        return { ...item, startColumn: start, endColumn: end, lane, tone: courseTone(colors.get(item.courseKey) ?? 0) };
      });
      return <div key={weekStart} className="relative grid grid-cols-7 border-b border-[#eee7dc] last:border-b-0" style={{ minHeight: Math.max(44, 40 + lanes.length * 29) }}>
        {Array.from({ length: 7 }, (_, day) => {
          const date = new Date(weekStart + day * DAY);
          const isToday = keyOf(date) === today;
          return <div key={day} className={`min-w-0 border-r border-[#f0ebe2] px-0.5 pt-1 text-center last:border-r-0 ${date.getUTCMonth() !== month.getUTCMonth() ? 'bg-[#faf9f6] text-[#8b857c]' : 'text-text'}`}>
            <time dateTime={keyOf(date)} aria-current={isToday ? 'date' : undefined} className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium tabular-nums ${isToday ? 'bg-crimson text-white' : ''}`}>{date.getUTCDate()}</time>
          </div>;
        })}
        {segments.map(item => <Link key={`${item.index}-${week}`} href={`/offline/${item.course.id}?source=platform`} title={`${getPublicCourseName(item.course)} · ${item.course.startDate} 至 ${item.course.endDate || item.course.startDate}`} aria-label={`${getPublicCourseName(item.course)}，${item.course.startDate}至${item.course.endDate || item.course.startDate}，查看详情`} className={`absolute mx-0.5 flex h-[25px] min-w-0 items-center rounded-[5px] px-1.5 text-xs font-semibold hover:brightness-95 ${focus}`} style={{ background: item.tone.background, color: item.tone.foreground, top: 36 + item.lane * 29, left: `${item.startColumn / 7 * 100}%`, width: `calc(${(item.endColumn - item.startColumn + 1) / 7 * 100}% - 4px)` }}><span className="truncate">{getPublicCourseName(item.course)}</span></Link>)}
      </div>;
    })}
    {!loading && count === 0 && <p role="status" className="px-4 py-4 text-center text-sm text-text-secondary">本月暂无课程安排，请切换月份查看。</p>}
    </div>
  </section>;
}
