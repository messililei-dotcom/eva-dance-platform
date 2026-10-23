import Link from 'next/link';
import { GraduationCap, ArrowRight } from 'lucide-react';
import ScrollAnimation from '@/components/ScrollAnimation';
import CourseCard from '@/components/CourseCard';
import SectionHeader from '@/components/SectionHeader';
import { courses } from '@/config/courses';

export default function FeaturedOfflineSection() {
  const offlineCourses = courses.filter(c => c.category === 'offline');
  // Fisher-Yates 洗牌随机取4门
  const shuffled = [...offlineCourses];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const featuredCourses = shuffled.slice(0, 4);

  return (
    <section className="py-10 md:py-14 bg-gradient-to-b from-warm-white to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <ScrollAnimation>
          <SectionHeader
            icon={GraduationCap}
            badge="线下培训"
            title="线下课程精选"
            subtitle="沉浸式面授培训，伊娃老师亲授，从爱好者到专业教师的蜕变之路"
          />
        </ScrollAnimation>

        {/* Course Grid - 使用 dance-style 变体，4:3主图，与线上课程卡片一致 */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 mb-10">
          {featuredCourses.map((course, i) => (
            <div key={course.id}>
              <ScrollAnimation delay={i * 100}>
                <CourseCard course={course} variant="dance-style" />
              </ScrollAnimation>
            </div>
          ))}
        </div>

        {/* View All */}
        <ScrollAnimation>
          <div className="text-center">
            <Link
              href="/offline"
              className="inline-flex items-center gap-2 px-6 py-3 border-2 border-crimson text-crimson font-medium rounded-full hover:bg-crimson hover:text-white transition-all"
            >
              查看全部线下课程
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </ScrollAnimation>
      </div>
    </section>
  );
}
