'use client';

import MobileAcademy from '@/components/MobileAcademy';

import { useEffect, useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, Sparkles, Users } from 'lucide-react';
import ScrollAnimation from '@/components/ScrollAnimation';
import CourseCard from '@/components/CourseCard';
import { courses, type Course } from '@/config/courses';
import Link from 'next/link';

type PlatformCourse = Course & {
  platformSeriesId?: number;
  platformCategory?: string;
  legacyCourseId?: string;
};

type PlatformStats = {
  total_series: number;
  online_series: number;
  dance_series: number;
  total_lessons: number;
  total_students: number;
};

export default function CoursesPage() {
  const [platformCourses, setPlatformCourses] = useState<PlatformCourse[]>([]);
  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null);
  const [homepageMembers, setHomepageMembers] = useState<number | null>(null);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [coursesError, setCoursesError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [platformReady, setPlatformReady] = useState(false);

  // 学员变化数据
  const transformations = [
    { before: '从完全不会', after: '能完成整套舞蹈', icon: '🚀' },
    { before: '西米不稳控制差', after: '西米稳定度明显提升', icon: '✅' },
    { before: '旋转头晕转不稳', after: '旋转连续能力提升', icon: '🔄' },
    { before: '动作生硬不干净', after: '动作更干净、更高级', icon: '✨' },
    { before: '只会模仿不会编', after: '能独立编舞创作', icon: '🎨' },
    { before: '只会跳不会教课', after: '从学员开始带课', icon: '👩‍🏫' },
  ];

  useEffect(() => {
    let mounted = true;

    async function loadPlatformCourses() {
      setCoursesLoading(true); setCoursesError('');
      try {
        const [res, homepageStats] = await Promise.all([
          fetch('/api/platform-courses', { cache: 'no-store' }),
          fetch('/api/mini/public/home-stats', { cache: 'no-store' })
            .then((response) => response.ok ? response.json() : null)
            .catch(() => null),
        ]);
        if (!res.ok) throw Error('课程加载失败，请重试');
        const data = await res.json();
        if (data?.success === false) throw Error(data.message || '课程加载失败，请重试');
        if (!mounted) return;
        const rows = Array.isArray(data) ? data : data.data || [];
        const memberCount = Number(homepageStats?.data?.members);
        setPlatformCourses(rows);
        setPlatformStats(data?.stats || null);
        setHomepageMembers(Number.isFinite(memberCount) && memberCount > 0 ? memberCount : null);
        setPlatformReady(Boolean(data?.success && rows.length));
      } catch (error) {
        console.error('加载数字化平台课程失败:', error);
        if (mounted) {
          setCoursesError('课程暂时无法加载，请重试');
          setPlatformCourses([]);
          setPlatformStats(null);
          setHomepageMembers(null);
          setPlatformReady(false);
        }
      } finally {
        if (mounted) setCoursesLoading(false);
      }
    }

    loadPlatformCourses();
    return () => { mounted = false; };
  }, [reloadKey]);

  const displayedCourses = useMemo(() => {
    const source = platformCourses.length
      ? platformCourses
      : courses
          .filter((course) => course.category === 'online' || course.category === 'dance-collection')
          .map(course => ({ ...course, duration: '课节以统一平台实时目录为准' }));

    return source
      .filter((course) => course.category === 'online' || course.category === 'dance-collection')
      .sort((a, b) => {
        if (a.category !== b.category) return a.category === 'online' ? -1 : 1;
        return Number(b.isHot) - Number(a.isHot) || Number(b.isNew) - Number(a.isNew);
      });
  }, [platformCourses]);

  const platformCourseByLegacyId = useMemo(() => {
    const map = new Map<string, string>();
    platformCourses.forEach((course) => {
      map.set(String(course.id), String(course.id));
    });
    platformCourses.forEach((course) => {
      if (course.legacyCourseId) map.set(String(course.legacyCourseId), String(course.id));
    });
    return map;
  }, [platformCourses]);

  const getOnlineCourseHref = (legacyCourseId: string) => {
    const platformCourseId = platformCourseByLegacyId.get(legacyCourseId);
    return platformCourseId ? `/courses/${platformCourseId}?source=platform` : `/courses/${legacyCourseId}`;
  };

  const getPlatformDuration = (legacyCourseId: string, fallback: string) => {
    const matched = platformCourses.find(course => String(course.legacyCourseId || course.id) === legacyCourseId);
    return matched?.duration || fallback;
  };

  const onlineCount = displayedCourses.filter((course) => course.category === 'online').length;
  const danceCount = displayedCourses.filter((course) => course.category === 'dance-collection').length;
  const displayedTotalLessons = 3000 + (platformStats?.total_lessons ?? 2032);
  const displayedTotalMembers = 10000 + (homepageMembers ?? 4066);
  const synchronizedStats = [
    { value: platformStats?.online_series ?? onlineCount, label: '线上系统课', suffix: '门' },
    { value: platformStats?.dance_series ?? danceCount, label: '成品舞课', suffix: '门' },
    { value: displayedTotalLessons, label: '总课节', suffix: '节' },
    { value: displayedTotalMembers.toLocaleString('en-US'), label: '总学员', suffix: '人' },
  ];
  return (
    <div className="courses-mobile-only">
      <div className="md:hidden"><MobileAcademy courses={platformCourses} loading={coursesLoading} error={coursesError} onRetry={()=>setReloadKey(v=>v+1)}/></div>
      {/* ===== Hero ===== */}
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-gold-dark via-gold to-crimson-dark pb-9 pt-28 md:block">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-crimson rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-white/20 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <ScrollAnimation>
            <div className="text-center">
              <span className="mb-3 inline-block rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white">
                ⚡ SWOD 教学系统
              </span>
              <h1 className="font-serif text-3xl font-bold text-white md:text-5xl">
                学东方舞，不要再靠感觉了
              </h1>

            </div>
          </ScrollAnimation>
        </div>
      </section>

      {/* ===== 痛点引入 ===== */}
      <section className="hidden bg-warm-white py-7 md:block md:py-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollAnimation>
            <h2 className="mb-3 font-serif text-2xl font-bold text-text md:text-3xl">
              你是不是也遇到这些问题？
            </h2>
            <div className="flex flex-wrap justify-center gap-2 md:flex-nowrap md:gap-1.5">
              {['学了很多不会跳', '动作不稳不高级', '西米抖不起', '旋转转不稳', '手臂僵硬', '不会编舞'].map((item, i) => (
                <span key={i} className="whitespace-nowrap rounded-full border border-red-100 bg-red-50 px-3 py-1.5 text-sm text-red-500 md:px-2.5 md:text-xs">
                  ✕ {item}
                </span>
              ))}
            </div>
          </ScrollAnimation>
        </div>
      </section>

      {/* ===== 成长路径（精简） ===== */}
      <section className="hidden bg-white py-4 md:block">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollAnimation>
            <div className="rounded-2xl border border-gold/10 bg-gold/5 p-3 md:p-4">
              <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
                {[
                  { step: '①', label: '零基础', sub: '入门' },
                  { step: '②', label: '身体能力', sub: '呼吸+肌力' },
                  { step: '③', label: '技术体系', sub: '全部技巧' },
                  { step: '④', label: '表达能力', sub: '舞感' },
                  { step: '⑤', label: '专项突破', sub: '西米/旋转' },
                  { step: '⑥', label: '编舞能力', sub: '创作' },
                  { step: '⑦', label: '教学能力', sub: '授课变现' },
                ].map((p, i) => (
                  <div key={i} className="rounded-lg border border-gold/10 bg-white/80 p-1.5 text-center">
                    <div className="text-lg">{p.step}</div>
                    <div className="font-semibold text-xs text-text">{p.label}</div>
                    <div className="text-[10px] text-text-muted">{p.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          </ScrollAnimation>
        </div>
      </section>

      {/* ===== 数字化平台课程卡片墙 ===== */}
      <section className="hidden bg-white pb-5 md:block pt-[calc(env(safe-area-inset-top)+4.5rem)] md:py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollAnimation>
            <div className="mb-5 grid grid-cols-4 gap-1.5">
                {[
                  { label: '线上课程', value: platformStats?.online_series ?? onlineCount, icon: BookOpen },
                  { label: '成品舞课', value: platformStats?.dance_series ?? danceCount, icon: Sparkles },
                  { label: '总课节', value: displayedTotalLessons, icon: CheckCircle2 },
                  { label: '总学员', value: displayedTotalMembers.toLocaleString('en-US'), icon: Users },
                ].map((item) => (
                  <div key={item.label} className="flex h-12 items-center justify-center gap-1.5 rounded-lg border border-sand/30 bg-warm-white px-2 text-center">
                    <item.icon className="h-3.5 w-3.5 shrink-0 text-gold-dark" />
                    <div className="leading-none">
                      <div className="text-base font-bold text-text">{item.value}</div>
                      <div className="mt-1 text-[9px] leading-none text-text-muted">{item.label}</div>
                    </div>
                  </div>
                ))}
            </div>
          </ScrollAnimation>

          {coursesLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
          ) : displayedCourses.length > 0 ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {displayedCourses.map((course, index) => (
                  <ScrollAnimation key={`${course.category}-${course.id}`} delay={(index % 8) * 50}>
                    <CourseCard course={course} variant="dance-style" />
                  </ScrollAnimation>
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-sand/30 bg-warm-white p-10 text-center">
              <BookOpen className="mx-auto mb-3 h-10 w-10 text-gold-dark" />
              <h3 className="font-serif text-xl font-bold text-text mb-2">
                课程正在同步
              </h3>
            </div>
          )}
        </div>
      </section>

      {/* ===== 学员真实变化（信任间隔） ===== */}
      <section className="hidden bg-gradient-to-br from-green-50 to-emerald-50 py-7 md:block md:py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollAnimation>
            <div className="mb-5 text-center">
              <h2 className="font-serif text-2xl md:text-3xl font-bold text-text mb-2">学员真实变化</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {transformations.map((t, i) => (
                <div key={i} className="rounded-xl border border-green-100 bg-white p-3 text-center shadow-sm transition-all hover:shadow-md">
                  <span className="text-2xl mb-2 block">{t.icon}</span>
                  <div className="text-xs text-red-400 line-through mb-1">{t.before}</div>
                  <div className="text-xs font-semibold text-green-700">{t.after}</div>
                </div>
              ))}
            </div>
          </ScrollAnimation>
        </div>
      </section>

      {/* ===== 讲师介绍 ===== */}
      <section className="hidden border-y border-sand/20 bg-white py-5 md:block">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollAnimation>
            <div className="flex items-center justify-center gap-4 mb-3">
              <div className="w-12 h-12 bg-gold/10 rounded-full flex items-center justify-center">
                <span className="text-2xl">👩‍🏫</span>
              </div>
              <div className="text-left">
                <h3 className="font-bold text-text">伊娃</h3>
                <p className="text-xs text-text-muted">东方舞艺术家 / SWOD教学系统创始人</p>
              </div>
            </div>
            <p className="text-xs text-text-muted">18年教学经验 · 专注打造东方舞系统化训练体系</p>
          </ScrollAnimation>
        </div>
      </section>

      {/* ===== 底部推荐 + 强转化 ===== */}
      <section className="hidden bg-warm-white py-8 md:block md:py-9">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* 推荐课程 */}
          <ScrollAnimation>
            <div className="mb-8">
              <div className="mb-5 text-center">
                <h2 className="font-serif text-2xl md:text-3xl font-bold text-text mb-2">推荐课程 · 立即开始</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { badge: '🔥 零基础入门', title: '东方舞零基础入门课程', desc: getPlatformDuration('7', '课节以统一平台为准'), legacyId: '7', color: 'from-green-500 to-emerald-600' },
                  { badge: '🔥 主推｜最推荐', title: '零基础·亲传教练系统课', desc: getPlatformDuration('15', '课节以统一平台为准'), legacyId: '15', color: 'from-gold to-gold-dark' },
                  { badge: '⚡ 专项爆款', title: '疯狂西米·全维度解锁锻造营', desc: getPlatformDuration('10', '课节以统一平台为准'), legacyId: '10', color: 'from-purple-500 to-purple-700' },
                  { badge: '🏆 顶级系统', title: '云·弟子班', desc: getPlatformDuration('5', '课节以统一平台为准'), legacyId: '5', color: 'from-crimson to-crimson-dark' },
                ].map((rec, i) => (
                  <a key={i} href={getOnlineCourseHref(rec.legacyId)} className="group bg-white rounded-xl overflow-hidden shadow-sm border border-sand/20 hover:shadow-lg hover:-translate-y-1 transition-all">
                    <div className={`bg-gradient-to-r ${rec.color} p-3 md:p-4 text-white`}>
                      <span className="text-[10px] md:text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full">{rec.badge}</span>
                    </div>
                    <div className="p-3 md:p-4">
                      <h4 className="font-bold text-text text-xs md:text-sm mb-1 group-hover:text-gold-dark transition-colors">{rec.title}</h4>
                      <p className="text-[10px] md:text-xs text-text-secondary">{rec.desc}</p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </ScrollAnimation>

          {/* 全体课程一览 */}
          <ScrollAnimation>
            <div className="mb-8 rounded-2xl border border-sand/20 bg-white p-5 shadow-sm md:p-6">
              <div className="text-center mb-6">
                <h3 className="font-serif text-xl font-bold text-text mb-2">全部课程一览</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {displayedCourses.filter(c => c.category === 'online').map(course => (
                  <a
                    key={course.id}
                    href={getOnlineCourseHref(String((course as PlatformCourse).legacyCourseId || course.id))}
                    className="group p-3 bg-gold/5 hover:bg-gold/10 rounded-xl border border-gold/10 hover:border-gold/30 transition-all text-center"
                  >
                    <div className="font-medium text-xs text-text group-hover:text-gold-dark transition-colors truncate">
                      {course.title}
                    </div>
                    <div className="text-[10px] text-text-muted mt-1">{course.duration}</div>
                  </a>
                ))}
              </div>
            </div>
          </ScrollAnimation>

          {/* 强转化CTA */}
          <ScrollAnimation>
            <div className="rounded-2xl border border-gold/20 bg-gradient-to-br from-crimson-dark/5 via-gold/5 to-black/5 p-6 text-center md:p-8">
              <h2 className="font-serif text-2xl md:text-3xl font-bold text-text mb-4">
                如果你认真想学东方舞
              </h2>
              <div className="flex flex-wrap justify-center gap-2 md:gap-3 mb-6">
                {['到处拼课程', '靠感觉练', '重复走弯路'].map((item, i) => (
                  <span key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-400 text-xs rounded-full border border-red-100">
                    ✕ {item}
                  </span>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row justify-center gap-3 md:gap-4">
                <Link
                  href="/about/brand-story"
                  className="px-6 md:px-8 py-3 bg-gradient-to-r from-gold to-gold-dark text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-gold/30 transition-all text-sm md:text-base"
                >
                  了解 SWOD 系统
                </Link>
                <Link
                  href="/enroll"
                  className="px-6 md:px-8 py-3 border-2 border-gold/40 text-gold-dark font-semibold rounded-xl hover:bg-gold/5 transition-all text-sm md:text-base"
                >
                  免费试听体验
                </Link>
              </div>
            </div>
          </ScrollAnimation>

          {/* 底部信任 */}
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            {synchronizedStats.map((stat, i) => (
              <div key={i} className="rounded-xl border border-sand/20 bg-white px-3 py-2 text-center">
                <div className="text-sm font-bold text-gold-dark md:text-lg">{stat.value}{stat.suffix}</div>
                <div className="text-[10px] text-text-muted">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
