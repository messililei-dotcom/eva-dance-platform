'use client';

import { useEffect, useState, useMemo } from 'react';
import { Grid3X3, Calendar, MapPin, ChevronRight, ChevronLeft, ChevronRight as NextIcon } from 'lucide-react';
import ScrollAnimation from '@/components/ScrollAnimation';
import CourseCard from '@/components/CourseCard';
import { type Course } from '@/config/courses';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { getPublicCourseName, PublicCourseRecord } from '@/lib/course-match';

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
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [calendarCourses, setCalendarCourses] = useState<PublicCourseRecord[]>([]);
  const [offlineCourses, setOfflineCourses] = useState<PlatformOfflineCourse[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [platformReady, setPlatformReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    fetch('/api/platform-offline-courses', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (!mounted) return;
        const rows: PlatformOfflineCourse[] = Array.isArray(data) ? data : data.data || [];
        setOfflineCourses(rows);
        setPlatformReady(Boolean(data?.success && rows.length));
        setCalendarCourses(rows.map((course) => ({
          id: course.legacyCourseId || course.id,
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

  // 月份名称
  const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

  // 课程日历视图 - 筛选课程
  const calendarFilteredCourses = useMemo(() => {
    return calendarCourses.filter(course => {
      if (selectedMonth !== 0) {
        if (!course.startDate) return false;
        const courseStartMonth = parseInt(course.startDate.split('-')[1], 10);
        const courseEndMonth = parseInt((course.endDate || course.startDate).split('-')[1], 10);
        const courseStartYear = parseInt(course.startDate.split('-')[0], 10);
        const courseEndYear = parseInt((course.endDate || course.startDate).split('-')[0], 10);
        
        const hasIntersection = 
          (courseStartYear <= 2026 && courseStartMonth <= selectedMonth) &&
          (courseEndYear >= 2026 && courseEndMonth >= selectedMonth);
          
        if (!hasIntersection) return false;
      }
      return true;
    });
  }, [calendarCourses, selectedMonth]);

  // 课程颜色
  const getCourseColor = (course: PublicCourseRecord) => {
    if (course.type === '集训' || course.type === 'bootcamp') return 'bg-red-500';
    if (course.type === '传承弟子' || course.type === 'masterclass') return 'bg-green-500';
    if (course.type === '认证班' || course.type === 'certification') return 'bg-blue-500';
    return 'bg-[#C8A96E]';
  };

  return (
    <div>
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
                把线上学到的体系，练成身体里的能力
              </h1>

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
            <>
              {/* 月份选择 */}
              <ScrollAnimation>
                <div className="mb-6 flex items-center justify-center gap-2">
                  <button
                    onClick={() => setSelectedMonth(Math.max(1, selectedMonth - 1))}
                    className="p-2 bg-white rounded-lg border border-gray-200 hover:border-crimson/30 transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div className="px-6 py-2 bg-crimson text-white rounded-lg font-medium">
                    2026年 {monthNames[selectedMonth - 1]}
                  </div>
                  <button
                    onClick={() => setSelectedMonth(Math.min(12, selectedMonth + 1))}
                    className="p-2 bg-white rounded-lg border border-gray-200 hover:border-crimson/30 transition-colors"
                  >
                    <NextIcon className="w-5 h-5" />
                  </button>
                </div>
              </ScrollAnimation>

              {/* 课程时间线 */}
              <ScrollAnimation delay={100}>
                <div className="space-y-4">
                  {calendarFilteredCourses.length > 0 ? (
                    calendarFilteredCourses.map((course, i) => (
                      <div key={course.id} className="flex gap-4 p-4 bg-white rounded-xl border border-gray-100 hover:border-crimson/30 transition-all">
                        {/* 时间 */}
                        <div className="flex-shrink-0 w-32">
                          <div className="text-sm font-medium text-crimson">
                            {course.startDate?.split('-').slice(1).join('/')} - {(course.endDate || course.startDate)?.split('-').slice(1).join('/')}
                          </div>
                          <div className="text-xs text-text-muted mt-1">
                            {(() => {
                              const start = new Date(course.startDate || '');
                              const end = new Date(course.endDate || course.startDate || '');
                              const days = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
                              return Number.isFinite(days) && days > 0 ? `${days}天` : '时间待定';
                            })()}
                          </div>
                        </div>
                        
                        {/* 课程信息 */}
                        <div className="flex-1">
                          <div className="flex items-start gap-3">
                            <div className={`w-3 h-3 rounded-full ${getCourseColor(course)} mt-1.5`}></div>
                            <div>
                              <Link
                                href={`/offline/${course.id}`}
                                className="block font-medium text-text mb-1 hover:text-crimson transition-colors"
                              >
                                {getPublicCourseName(course)}
                              </Link>
                              <div className="flex flex-wrap gap-2 text-xs">
                                <span className="px-2 py-0.5 bg-crimson/10 text-crimson rounded-full">{course.type}</span>
                                {course.scheduleLabel && (
                                  <span className="px-2 py-0.5 bg-gray-100 text-text-secondary rounded-full">{course.scheduleLabel}</span>
                                )}
                                {course.teacher && (
                                  <span className="px-2 py-0.5 bg-gold/10 text-gold-dark rounded-full">{course.teacher}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* 价格 */}
                        <div className="flex-shrink-0 text-right">
                          <div className="text-lg font-bold text-crimson">¥{Number(course.price || 0).toLocaleString()}</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-16">
                      <Calendar className="w-12 h-12 text-crimson/30 mx-auto mb-4" />
                      <p className="text-text-muted">本月暂无课程安排</p>
                      <p className="text-text-secondary text-sm">请切换其他月份查看</p>
                    </div>
                  )}
                </div>
              </ScrollAnimation>

              {/* 查看全部课程期次 */}
              <ScrollAnimation delay={200}>
                <div className="mt-6 text-center">
                  <Link
                    href="/offline?tab=courses"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-crimson text-white rounded-full hover:bg-crimson-dark transition-all"
                  >
                    查看全部课程期次
                    <NextIcon className="w-4 h-4" />
                  </Link>
                </div>
              </ScrollAnimation>
            </>
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
