'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PlayCircle, ArrowRight } from 'lucide-react';
import ScrollAnimation from '@/components/ScrollAnimation';
import CourseCard from '@/components/CourseCard';
import SectionHeader from '@/components/SectionHeader';
import { courses, type Course } from '@/config/courses';

export default function VideoCoursesSection() {
  const onlineCourses = useMemo(() => courses.filter(c => c.category === 'online'), []);
  const fallbackCourses = useMemo(
    () => onlineCourses.map(course => ({ ...course, duration: '课节以统一平台实时目录为准' })),
    [onlineCourses],
  );
  const [featuredCourses, setFeaturedCourses] = useState<Course[]>(() => fallbackCourses.slice(0, 4));

  useEffect(() => {
    let active = true;
    fetch('/api/platform-courses', { cache: 'no-store' })
      .then(response => response.ok ? response.json() : null)
      .then(payload => {
        const rows = Array.isArray(payload) ? payload : payload?.data;
        if (!active || !Array.isArray(rows)) return;
        const online = rows.filter((course: Course) => course.category === 'online');
        if (online.length) setFeaturedCourses(online.slice(0, 4));
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  return (
    <section className="bg-warm-white py-6 md:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <ScrollAnimation>
          <SectionHeader
            number="02"
            icon={PlayCircle}
            badge="线上学院"
            title="把文化理解带进日常训练"
            subtitle="从入门基础、身体能力到技巧系统，线上课程让东方舞学习可以反复练习、持续复盘。"
          />
        </ScrollAnimation>

        {/* Course Grid - 使用 dance-style 变体，4:3主图 */}
        <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-2 md:mb-6 md:gap-4 lg:grid-cols-4">
          {featuredCourses.map((course, i) => (
            <ScrollAnimation key={course.id} delay={i * 100}>
              <CourseCard course={course} variant="dance-style" />
            </ScrollAnimation>
          ))}
        </div>

        {/* View All */}
        <ScrollAnimation>
          <div className="text-center">
            <Link
              href="/courses"
              className="inline-flex items-center gap-2 px-6 py-3 border-2 border-gold text-gold font-medium rounded-full hover:bg-gold hover:text-white transition-all"
            >
              查看全部课程
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </ScrollAnimation>
      </div>
    </section>
  );
}
