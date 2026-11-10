'use client';

import { useEffect, useState, useMemo } from 'react';
import { Grid3X3, Calendar, MapPin, ChevronRight, ChevronRight as NextIcon } from 'lucide-react';
import ScrollAnimation from '@/components/ScrollAnimation';
import OfflineMonthCalendar from '@/components/OfflineMonthCalendar';
import CourseCard from '@/components/CourseCard';
import { type Course } from '@/config/courses';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { PublicCourseRecord } from '@/lib/course-match';

type PlatformOfflineCourse = Course & {
  platformCourseId?: number;
  legacyCourseId?: string;
  platformStatus?: string;
  remaining?: number;
  capacity?: number;
  startDate?: string;
  endDate?: string;
  location?: string;
  sessionCount?: number;
  latestEndDate?: string;
};

const PLACEHOLDER_COVERS = new Set([
  '',
  '/images/placeholder.svg',
  '/images/courses/placeholder-course.svg',
]);

function normalizeCourseGroupTitle(title: string): string {
  return title
    .replace(/\b20\d{2}[年/-]?\d{0,2}[月/-]?\d{0,2}\b/g, '')
    .replace(/\d+\s*(天|日|节|课时|课次|小时)/g, '')
    .replace(/[（(]\s*(第?\d+期|20\d{2}年?|已结束|火热报名|招生中)\s*[）)]/g, '')
    .replace(/\s+/g, '')
    .trim();
}

function getOfflineCourseGroupKey(course: PlatformOfflineCourse): string {
  return course.legacyCourseId || normalizeCourseGroupTitle(course.title) || String(course.platformCourseId || course.id);
}

function hasCourseCover(course: PlatformOfflineCourse): boolean {
  return !PLACEHOLDER_COVERS.has(String(course.image || '').trim());
}

function pickRepresentativeCourse(current: PlatformOfflineCourse, next: PlatformOfflineCourse): PlatformOfflineCourse {
  const currentInactive = /inactive|ended|closed|cancelled|offline/i.test(String(current.platformStatus || ''));
  const nextInactive = /inactive|ended|closed|cancelled|offline/i.test(String(next.platformStatus || ''));
  const currentDate = String(current.startDate || current.endDate || '');
  const nextDate = String(next.startDate || next.endDate || '');

  if (currentDate !== nextDate) return nextDate > currentDate ? next : current;
  if (currentInactive !== nextInactive) return nextInactive ? current : next;
  return Number(next.platformCourseId || next.id) > Number(current.platformCourseId || current.id) ? next : current;
}

function mergeOfflineCourseSessions(courses: PlatformOfflineCourse[]): PlatformOfflineCourse[] {
  const grouped = new Map<string, PlatformOfflineCourse & { sessionCount: number; latestEndDate?: string }>();

  courses.forEach((course) => {
    const key = getOfflineCourseGroupKey(course);
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, {
        ...course,
        sessionCount: 1,
        latestEndDate: course.endDate || course.startDate,
      });
      return;
    }

    const representative = pickRepresentativeCourse(existing, course);
    const coverSource = hasCourseCover(representative)
      ? representative
      : hasCourseCover(existing)
        ? existing
        : course;
    grouped.set(key, {
      ...representative,
      image: coverSource.image,
      sessionCount: existing.sessionCount + 1,
      latestEndDate: [existing.latestEndDate, course.endDate || course.startDate].filter(Boolean).sort().at(-1),
    });
  });

  const today = new Date().toISOString().slice(0, 10);
  const sortMeta = (course: PlatformOfflineCourse) => {
    const start = String(course.startDate || '');
    const end = String(course.endDate || '');
    const validEnd = end && (!start || end >= start) ? end : '';
    const inactive = /inactive|ended|closed|cancelled|offline/i.test(String(course.platformStatus || ''));

    if (!inactive && start >= today) return { bucket: 0, date: start };
    if (!inactive && start && start < today && (!validEnd || validEnd >= today)) return { bucket: 1, date: start };
    if (!inactive && !start) return { bucket: 2, date: '' };
    return { bucket: 3, date: validEnd || start || course.latestEndDate || '' };
  };

  return Array.from(grouped.values()).sort((a, b) => {
    const aMeta = sortMeta(a);
    const bMeta = sortMeta(b);
    if (aMeta.bucket !== bMeta.bucket) return aMeta.bucket - bMeta.bucket;
    if (aMeta.date !== bMeta.date) return bMeta.date.localeCompare(aMeta.date);
    return a.title.localeCompare(b.title, 'zh-CN');
  });
}

export default function OfflineCoursesPage() {
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [calendarCourses, setCalendarCourses] = useState<PublicCourseRecord[]>([]);
  const [offlineCourses, setOfflineCourses] = useState<PlatformOfflineCourse[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [calendarError, setCalendarError] = useState(false);
  const [platformReady, setPlatformReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    fetch('/api/platform-offline-courses', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (!mounted) return;
        if (data?.success === false) throw new Error(data.error || '课程排期加载失败');
        const rows: PlatformOfflineCourse[] = Array.isArray(data) ? data : data.data || [];
        setOfflineCourses(rows);
        setPlatformReady(Boolean(data?.success && rows.length));
        setCalendarCourses(rows.map((course) => ({
          id: course.platformCourseId || course.id,
          name: course.title,
          officialCourseName: course.title,
          type: course.type,
          subType: course.level,
          scheduleLabel: course.dateRange,
          startDate: course.startDate,
          endDate: course.endDate,
          price: course.price,
          sessions: Number.parseInt(course.duration, 10) || 0,
          teacher: course.instructor,
          content: course.description,
        })));
      })
      .catch(error => {
        console.error('加载数字化平台线下课程失败:', error);
        if (mounted) {
          setCalendarError(true);
          setOfflineCourses([]);
          setCalendarCourses([]);
        }
      })
      .finally(() => {
        if (mounted) setCoursesLoading(false);
      });

    return () => { mounted = false; };
  }, []);

  const groupedOfflineCourses = useMemo(() => mergeOfflineCourseSessions(offlineCourses), [offlineCourses]);

  // 统计
  const cityNames = Array.from(new Set(offlineCourses.map((course) => course.location).filter(Boolean))).slice(0, 6);
  const stats = {
    total: groupedOfflineCourses.length,
    cities: cityNames.length ? cityNames : ['长沙', '北京', '上海', '广州', '深圳', '成都'],
    upcoming: groupedOfflineCourses.filter((course) => course.startDate && course.startDate >= new Date().toISOString().slice(0, 10)).length,
  };

  return (
    <div className="mobile-offline-catalog">
      {/* Header */}
      <section className="relative overflow-hidden bg-gradient-to-br from-crimson via-crimson-dark to-gold-dark pb-10 pt-8 md:pb-14 md:pt-10">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-gold rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-white/20 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <ScrollAnimation>
            <div className="text-center">
              <span className="inline-block px-3 py-1 bg-white/10 text-gold-light text-sm font-medium rounded-full mb-4 border border-white/20">
                🏆 SWOD 线下培训系统
              </span>
              <h1 className="font-serif text-3xl md:text-5xl font-bold text-white mb-4">
                <span className="md:hidden">线下课</span><span className="hidden md:inline">把线上学到的体系，练成身体里的能力</span>
              </h1>

              <p className="mb-5 text-sm leading-6 text-[#616773] md:hidden">购买课程期次的课时，到课后核销扣减，无需预约。</p>
              {/* 快捷统计 */}
              <div className="flex justify-center gap-4 md:gap-8">
                <div className="text-center">
                  <div className="text-2xl md:text-3xl font-bold text-white">{stats.total}</div>
                  <div className="text-white/60 text-sm">线下课程</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl md:text-3xl font-bold text-gold">6</div>
                  <div className="text-white/60 text-sm">训练系统</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl md:text-3xl font-bold text-white">SWOD</div>
                  <div className="text-white/60 text-sm">认证路径</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl md:text-3xl font-bold text-gold">{stats.upcoming}</div>
                  <div className="text-white/60 text-sm">即将开课</div>
                </div>
              </div>
            </div>
          </ScrollAnimation>
        </div>
      </section>

      {/* Content */}
      <section id="master" className="scroll-mt-24 bg-warm-white py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* 视图切换 - 课程列表 vs 课程日历 */}
          <ScrollAnimation>
            <div className="mb-6 flex items-center justify-center gap-4">
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'flex items-center gap-2 px-6 py-3 rounded-full font-medium transition-all',
                  viewMode === 'list'
                    ? 'bg-crimson text-white shadow-lg'
                    : 'bg-white text-text border border-gray-200 hover:border-crimson/30'
                )}
              >
                <Grid3X3 className="w-5 h-5" />
                课程列表
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={cn(
                  'flex items-center gap-2 px-6 py-3 rounded-full font-medium transition-all',
                  viewMode === 'calendar'
                    ? 'bg-crimson text-white shadow-lg'
                    : 'bg-white text-text border border-gray-200 hover:border-crimson/30'
                )}
              >
                <Calendar className="w-5 h-5" />
                课程日历
              </button>
            </div>
          </ScrollAnimation>

          {/* 课程列表视图 */}
          {viewMode === 'list' && (
            <>
              {coursesLoading ? (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, index) => (
                    <div key={index} className="overflow-hidden rounded-xl border border-sand/20 bg-white shadow-sm">
                      <div className="aspect-[4/3] animate-pulse bg-sand/30" />
                      <div className="space-y-2 p-4">
                        <div className="h-4 w-3/4 animate-pulse rounded bg-sand/40" />
                        <div className="h-3 w-full animate-pulse rounded bg-sand/30" />
                        <div className="h-3 w-1/2 animate-pulse rounded bg-sand/30" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : groupedOfflineCourses.length > 0 ? (
                <>
                  <div className="mb-5 flex flex-wrap items-center gap-2 text-xs text-text-muted">
                    <span>共 {groupedOfflineCourses.length} 门线下课程</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                    {groupedOfflineCourses.map((course, i) => (
                      <ScrollAnimation key={course.platformCourseId || course.id} delay={(i % 8) * 50}>
                        <CourseCard course={course} variant="dance-style" />
                      </ScrollAnimation>
                    ))}
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-sand/30 bg-white p-10 text-center">
                  <Calendar className="mx-auto mb-3 h-10 w-10 text-crimson/50" />
                  <h3 className="font-serif text-xl font-bold text-text mb-2">暂无线下课程</h3>
                </div>
              )}
            </>
          )}

          {/* 课程日历视图 */}
          {viewMode === 'calendar' && (
            calendarError ? <div role="alert" className="rounded-xl border border-[#e8ddcb] bg-white p-6 text-center">
              <p>课程排期加载失败，请重试。</p>
              <button type="button" onClick={() => window.location.reload()} className="mt-3 rounded-lg bg-crimson px-5 py-3 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crimson">重新加载</button>
            </div> : <OfflineMonthCalendar courses={calendarCourses} loading={coursesLoading} />
          )}
        </div>
      </section>

      {/* 培训地点 */}
      <section className="py-12 bg-sand/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollAnimation>
            <div className="text-center mb-8">
              <h2 className="font-serif text-2xl font-bold text-text mb-2">培训地点覆盖</h2>
            </div>
          </ScrollAnimation>
          
          <ScrollAnimation delay={100}>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              {stats.cities.map((city) => (
                <div key={city} className="p-4 bg-white rounded-xl text-center shadow-sm border border-gray-100 hover:border-gold/30 transition-colors">
                  <MapPin className="w-5 h-5 text-crimson mx-auto mb-2" />
                  <span className="font-medium text-text">{city}</span>
                </div>
              ))}
            </div>
          </ScrollAnimation>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 bg-gradient-to-r from-crimson to-crimson-dark">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollAnimation>
            <h2 className="font-serif text-2xl md:text-3xl font-bold text-white mb-4">
              线下课程咨询
            </h2>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link
                href="/enroll"
                className="px-8 py-3 bg-gold text-white font-medium rounded-full hover:shadow-lg hover:shadow-gold/30 transition-all"
              >
                立即咨询
              </Link>
              <Link
                href="/courses"
                className="px-8 py-3 bg-white/10 text-white font-medium rounded-full border border-white/30 hover:bg-white/20 transition-all"
              >
                先看线上课程
              </Link>
            </div>
          </ScrollAnimation>
        </div>
      </section>
    </div>
  );
}
