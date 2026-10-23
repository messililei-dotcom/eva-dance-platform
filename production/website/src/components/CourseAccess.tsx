"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { getStudentSession, STUDENT_AUTH_CHANGED_EVENT } from '@/lib/student-auth';
import { getPlatformSeriesIdForLegacyCourse } from '@/lib/course-series-ids';

type Access = { member: string; ids: Set<number>; pending: boolean; failed: boolean };
const empty: Access = { member: '', ids: new Set(), pending: true, failed: false };
const Context = createContext<Access>(empty);
export function CourseAccessProvider({ children }: { children: ReactNode }) {
  const [access, setAccess] = useState<Access>(empty);
  const path = usePathname();
  useEffect(() => {
    let version = 0, disposed = false;
    const refresh = async () => {
      const current = ++version, session = getStudentSession();
      setAccess(previous => ({ member: session?.id || '', ids: session && previous.member === session.id ? previous.ids : new Set(), pending: Boolean(session), failed: false }));
      if (!session) return;
      try {
        const response = await fetch('/api/learn/authorized-series', { cache: 'no-store', headers: { Authorization: `Bearer ${session.token}` } });
        const payload = await response.json();
        if (!response.ok || payload.success === false || !Array.isArray(payload.data)) throw Error('权益查询失败');
        if (disposed || current !== version || getStudentSession()?.id !== session.id) return;
        const ids = new Set<number>(payload.data.map((row: { series_id?: number; id?: number }) => Number(row.series_id || row.id)).filter((id: number) => Number.isInteger(id) && id > 0));
        setAccess({ member: session.id, ids, pending: false, failed: false });
      } catch {
        if (!disposed && current === version) setAccess({ member: session.id, ids: new Set(), pending: false, failed: true });
      }
    };
    const visible = () => { if (!document.hidden) void refresh(); };
    void refresh();
    window.addEventListener(STUDENT_AUTH_CHANGED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', visible);
    const timer = window.setInterval(visible, 30000);
    return () => { disposed = true; version++; clearInterval(timer); window.removeEventListener(STUDENT_AUTH_CHANGED_EVENT, refresh); window.removeEventListener('storage', refresh); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', visible); };
  }, [path]);
  return <Context.Provider value={access}>{children}</Context.Provider>;
}
export function useCourseAccess(seriesId?: string | number | null) {
  const value = useContext(Context);
  return { unlocked: value.ids.has(Number(seriesId)), pending: value.pending, unavailable: value.failed, hideSales: value.pending || value.failed || value.ids.has(Number(seriesId)) };
}
export function courseSeriesId(course: { id: string; category?: string; platformSeriesId?: number; platformCourseId?: number; legacyCourseId?: string }) {
  if (course.category === 'offline') return null;
  return course.platformSeriesId || course.platformCourseId || getPlatformSeriesIdForLegacyCourse(course.legacyCourseId || course.id) || null;
}
export function CourseAccessLabel({ seriesId, price, originalPrice, showAction = false, pricingConfirmed = true }: { seriesId?: string | number | null; price?: number; originalPrice?: number; showAction?: boolean; pricingConfirmed?: boolean }) {
  const access = useCourseAccess(seriesId);
  if (!seriesId) return null;
  if (access.unlocked) return <span className="font-semibold text-green-700">✓ 已解锁{showAction && <span className="ml-2 text-sm">继续学习</span>}</span>;
  if (access.pending || access.unavailable) return <span className="text-sm text-text-muted">{access.pending ? '正在查询学习权益…' : '学习权益暂无法确认'}</span>;
  if (!pricingConfirmed) return <span className="text-sm text-text-muted">售价以课程订单为准</span>;
  return <span className="inline-flex flex-wrap items-baseline gap-2"><span className="font-semibold text-crimson">{Number(price) > 0 ? `¥${Number(price).toLocaleString('zh-CN')}` : '免费'}</span>{Number(originalPrice) > Number(price) && Number(price) > 0 && <span className="text-xs text-text-muted line-through">原价 ¥{Number(originalPrice).toLocaleString('zh-CN')}</span>}</span>;
}
