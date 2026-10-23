'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, MapPin, Music, PlayCircle, Search } from 'lucide-react';
import PlaceholderImage from '@/components/PlaceholderImage';
import { courses, type Course } from '@/config/courses';
import { getCourseVideoHref } from '@/lib/course-series-ids';

const randomizeCourses = (items: Course[]) => {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, 10);
};

const getCourseHref = (course: Course) => {
  if (course.category === 'offline') return `/offline/${course.id}`;
  if (course.category === 'online' || course.category === 'dance-collection') {
    return getCourseVideoHref({ courseId: course.id });
  }
  return `/courses/${course.id}`;
};

export default function MobileLearningWindow() {
  const [platformDanceCount, setPlatformDanceCount] = useState<number | null>(null);
  const recommendableCourses = useMemo(
    () => courses
      .filter((course) => ['online', 'offline', 'dance-collection'].includes(course.category))
      .map(course => course.category === 'offline'
        ? course
        : { ...course, duration: '课节以统一平台实时目录为准' }),
    []
  );
  // Keep the server and first client render identical; randomize only after hydration.
  const [featuredCourses, setFeaturedCourses] = useState<Course[]>(() => recommendableCourses.slice(0, 10));
  const onlineCourseCount = courses.filter((course) => course.category === 'online').length;
  const offlineCourseCount = courses.filter((course) => course.category === 'offline').length;
  const danceCollectionCount = courses.filter((course) => course.category === 'dance-collection').length;
  const displayedDanceCount = platformDanceCount ?? danceCollectionCount;

  useEffect(() => {
    let active = true;
    const offlineCourses = courses.filter(course => course.category === 'offline');
    fetch('/api/platform-courses', { cache: 'no-store' })
      .then(response => response.ok ? response.json() : null)
      .then(payload => {
        const rows = Array.isArray(payload) ? payload : payload?.data;
        if (active && Array.isArray(rows) && rows.length) {
          setFeaturedCourses(randomizeCourses([...rows, ...offlineCourses]));
        } else if (active) {
          setFeaturedCourses(randomizeCourses(recommendableCourses));
        }
      })
      .catch(() => { if (active) setFeaturedCourses(randomizeCourses(recommendableCourses)); });
    return () => { active = false; };
  }, [recommendableCourses]);

  useEffect(() => {
    let active = true;
    fetch('/api/mini/public/home-stats')
      .then((res) => res.ok ? res.json() : null)
      .then((payload) => {
        const count = Number(payload?.data?.dance_count);
        if (active && Number.isFinite(count) && count > 0) setPlatformDanceCount(count);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="min-h-[100svh] bg-[#F8F3EA] pb-4 pt-0">
      <div className="px-0">
        <div className="border-b border-[#E5D3B5] bg-white shadow-[0_12px_32px_rgba(58,42,30,0.10)]">
          <div className="relative overflow-hidden bg-[#2F211B] px-4 py-4 text-white">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(139,26,26,0.86),rgba(47,33,27,0.94)_48%,rgba(184,148,78,0.72))]" />
            <div className="relative">
              <div className="grid grid-cols-[1fr_1fr_40px] items-center gap-2">
                <Link
                  href="/courses"
                  className="inline-flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-md bg-[#F5DEAA] px-2 text-sm font-semibold text-[#4B241D] shadow-lg shadow-black/10"
                >
                  <PlayCircle className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">继续学习</span>
                </Link>
                <Link
                  href="/courses"
                  className="inline-flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-md border border-white/24 bg-white/10 px-2 text-sm font-semibold text-white"
                >
                  <span className="truncate">全部课程</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                </Link>
                <Link
                  href="/courses"
                  className="flex h-10 w-10 items-center justify-center rounded-md border border-white/18 bg-white/10 text-white"
                  aria-label="搜索课程"
                >
                  <Search className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 border-b border-[#EFE3D2] bg-[#FFFBF6] text-center">
            {[
              { icon: BookOpen, label: '线上课程', value: `${onlineCourseCount}门` },
              { icon: MapPin, label: '线下集训', value: `${offlineCourseCount}门` },
              { icon: Music, label: '成品舞', value: `${displayedDanceCount}支` },
            ].map((item) => (
              <div key={item.label} className="border-r border-[#EFE3D2] px-2 py-3 last:border-r-0">
                <item.icon className="mx-auto mb-1 h-4 w-4 text-[#B8944E]" />
                <div className="text-sm font-bold text-[#3A2A1E]">{item.value}</div>
                <div className="mt-0.5 text-[11px] text-[#7A6A57]">{item.label}</div>
              </div>
            ))}
          </div>

          <div className="p-4">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#B8944E]">Featured Courses</p>
                <h2 className="mt-1 font-serif text-xl font-bold text-[#1A1A1A]">推荐视频课</h2>
              </div>
              <Link href="/courses" className="shrink-0 text-xs font-semibold text-[#8B1A1A]">
                查看更多
              </Link>
            </div>

            <div className="space-y-3">
              {featuredCourses.map((course) => (
                <Link
                  key={course.id}
                  href={getCourseHref(course)}
                  className="grid grid-cols-[92px_1fr] gap-3 rounded-md border border-[#EFE3D2] bg-white p-2 shadow-sm"
                >
                  <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-[#F3E9D8]">
                    <PlaceholderImage src={course.image} alt={course.title} />
                  </div>
                  <div className="min-w-0 py-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="rounded bg-[#F7EEE2] px-1.5 py-0.5 text-[10px] font-semibold text-[#8B1A1A]">
                        {course.category === 'offline' ? '线下课程' : course.category === 'dance-collection' ? '成品舞' : '线上视频'}
                      </span>
                      <span className="truncate text-[10px] text-[#7A6A57]">{course.duration}</span>
                    </div>
                    {course.displayStudents !== undefined && <p className="mt-1 text-xs text-[#7A6A57]">{course.displayStudents}名学员</p>}
                    <h3 className="mt-1.5 line-clamp-2 text-sm font-semibold leading-5 text-[#1A1A1A]">
                      {course.title}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#6E6256]">
                      {course.description}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
