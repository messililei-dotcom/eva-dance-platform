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
const tones = [
  'bg-[#f9dfe0] text-[#842e39]',
  'bg-[#dcecd6] text-[#315c35]',
  'bg-[#dce7f4] text-[#345575]',
  'bg-[#f4e7cc] text-[#745529]',
];
function tone(course: PublicCourseRecord) {
  if (/集训|bootcamp/.test(course.type || '')) return tones[0];
  if (/传承|masterclass/.test(course.type || '')) return tones[1];
  if (/认证|certification/.test(course.type || '')) return tones[2];
  return tones[3];
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
    return start && end && end >= start ? [{ course, index, start: start.getTime(), end: end.getTime() }] : [];
  }).sort((a, b) => a.start - b.start || b.end - a.end || a.index - b.index), [courses]);
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
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
      <div><h2 aria-live="polite" className="text-xl font-semibold tabular-nums text-text">{month.getUTCFullYear()}年{month.getUTCMonth() + 1}月</h2><p className="mt-1 text-xs text-text-secondary">{loading ? '课程排期加载中…' : `${count} 个课程期次 · 点击色块查看详情`}</p></div>
      <div className="flex items-center gap-1">
        <button type="button" aria-label="上个月" onClick={() => move(-1)} className={`flex h-11 w-11 items-center justify-center rounded-lg hover:bg-sand ${focus}`}><ChevronLeft size={20} /></button>
        <button type="button" onClick={() => { const now = new Date(); setMonth(new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1))); }} className={`h-11 rounded-lg px-3 text-sm text-crimson hover:bg-sand ${focus}`}>本月</button>
        <button type="button" aria-label="下个月" onClick={() => move(1)} className={`flex h-11 w-11 items-center justify-center rounded-lg hover:bg-sand ${focus}`}><ChevronRight size={20} /></button>
      </div>
    </div>
    <div
      style={{ touchAction: 'pan-y pinch-zoom' }}
      onTouchStart={startSwipe}
      onTouchMove={trackSwipe}
      onTouchEnd={endSwipe}
      onTouchCancel={() => { gesture.current = null; }}
      onClickCapture={event => {
        if (Date.now() < suppressClickUntil.current) { event.preventDefault(); event.stopPropagation(); }
      }}
    >
    <div className="grid grid-cols-7 border-y border-[#eee7dc] bg-[#faf7f1] py-3 text-center text-xs font-medium text-text-secondary">
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
        return { ...item, startColumn: start, endColumn: end, lane };
      });
      return <div key={weekStart} className="relative grid grid-cols-7 border-b border-[#eee7dc] last:border-b-0" style={{ minHeight: Math.max(116, 52 + lanes.length * 36) }}>
        {Array.from({ length: 7 }, (_, day) => {
          const date = new Date(weekStart + day * DAY);
          const isToday = keyOf(date) === today;
          return <div key={day} className={`min-w-0 border-r border-[#f0ebe2] px-1 pt-2 text-center last:border-r-0 ${date.getUTCMonth() !== month.getUTCMonth() ? 'bg-[#faf9f6] text-[#8b857c]' : 'text-text'}`}>
            <time dateTime={keyOf(date)} aria-current={isToday ? 'date' : undefined} className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium tabular-nums ${isToday ? 'bg-crimson text-white' : ''}`}>{date.getUTCDate()}</time>
          </div>;
        })}
        {segments.map(item => <Link key={`${item.index}-${week}`} href={`/offline/${item.course.id}?source=platform`} title={`${getPublicCourseName(item.course)} · ${item.course.startDate} 至 ${item.course.endDate || item.course.startDate}`} aria-label={`${getPublicCourseName(item.course)}，${item.course.startDate}至${item.course.endDate || item.course.startDate}，查看详情`} className={`absolute mx-0.5 flex h-8 min-w-0 items-center rounded px-1.5 text-xs font-medium hover:brightness-95 sm:px-2 sm:text-sm ${tone(item.course)} ${focus}`} style={{ top: 44 + item.lane * 36, left: `${item.startColumn / 7 * 100}%`, width: `calc(${(item.endColumn - item.startColumn + 1) / 7 * 100}% - 4px)` }}><span className="truncate">{getPublicCourseName(item.course)}</span></Link>)}
      </div>;
    })}
    {!loading && count === 0 && <p role="status" className="px-4 py-4 text-center text-sm text-text-secondary">本月暂无课程安排，请切换月份查看。</p>}
    </div>
  </section>;
}
