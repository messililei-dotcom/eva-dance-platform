'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { GraduationCap, Calendar, Clock, MapPin, ArrowRight, Award, Users } from 'lucide-react';
import { courses } from '@/config/courses';
import ScrollAnimation from '@/components/ScrollAnimation';
import SectionHeader from '@/components/SectionHeader';
import Image from 'next/image';

const typeLabels: Record<string, string> = {
  bootcamp: '集训营',
  cert: '师资认证班',
  certification: '师资认证',
  private: '私教1对1',
  enterprise: '企业定制',
};

const levelColors: Record<string, string> = {
  '基础': 'bg-blue-100 text-blue-700',
  '基础进阶': 'bg-cyan-100 text-cyan-700',
  '中级': 'bg-yellow-100 text-yellow-700',
  '中阶': 'bg-yellow-100 text-yellow-700',
  '中高阶': 'bg-orange-100 text-orange-700',
  '高级': 'bg-red-100 text-red-700',
  '高阶': 'bg-red-100 text-red-700',
};

export default function OfflineFeaturedSection() {
  const offlineCourses = useMemo(() => courses.filter(c => c.category === 'offline'), []);
  const [featuredCourses, setFeaturedCourses] = useState(() => offlineCourses.slice(0, 4));

  useEffect(() => {
    const shuffled = [...offlineCourses].sort(() => Math.random() - 0.5);
    setFeaturedCourses(shuffled.slice(0, 4));
  }, [offlineCourses]);

  return (
    <section className="bg-gradient-to-b from-warm-white to-white py-6 md:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <ScrollAnimation>
          <SectionHeader
            number="06"
            icon={GraduationCap}
            badge="线下培训"
            title="在面对面课堂中完成师资传承"
            subtitle="线下集训把动作纠正、课堂组织、教学表达和考核反馈连接起来，让东方舞文化真正被带回各地课堂。"
          />
        </ScrollAnimation>

        {/* 培训特色 */}
        <ScrollAnimation delay={100}>
          <div className="mb-4 rounded-xl border border-crimson/10 bg-gradient-to-r from-crimson/5 to-transparent p-3 md:mb-5 md:p-4">
            <div className="flex flex-wrap justify-center gap-2.5 md:gap-4">
              <div className="flex items-center gap-2 text-sm">
                <Award className="w-4 h-4 text-crimson" />
                <span className="text-text-secondary">伊娃老师亲授</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Users className="w-4 h-4 text-crimson" />
                <span className="text-text-secondary">小班教学</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <GraduationCap className="w-4 h-4 text-crimson" />
                <span className="text-text-secondary">结业认证</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-crimson" />
                <span className="text-text-secondary">全国多城</span>
              </div>
            </div>
          </div>
        </ScrollAnimation>

        {/* Course Grid - 4:3 course covers */}
        <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-2 md:mb-6 md:gap-4 lg:grid-cols-4">
          {featuredCourses.map((course, index) => {
            const typeLabel = typeLabels[course.type] || course.type || '火热招募中';
            const levelColor = levelColors[course.level] || 'bg-gray-100 text-gray-700';

            return (
              <ScrollAnimation key={course.id} delay={index * 80}>
                <Link
                  href={`/offline/${course.id}`}
                  className="group block overflow-hidden rounded-xl border border-sand/20 bg-white shadow-md transition-all duration-300 hover:border-crimson/40 hover:shadow-xl md:rounded-2xl"
                >
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <Image
                      src={course.image}
                      alt={course.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 25vw"
                    />
                    {/* Badge Row */}
                    <div className="absolute left-2 top-2 flex max-w-[calc(100%-1rem)] flex-wrap gap-1 md:left-3 md:top-3 md:gap-2">
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium md:px-2 md:text-xs ${levelColor}`}>
                        {course.level}
                      </span>
                      <span className="rounded-full bg-crimson/10 px-1.5 py-0.5 text-[10px] font-medium text-crimson md:px-2 md:text-xs">
                        {typeLabel}
                      </span>
                    </div>
                    {/* HOT/NEW badges */}
                    <div className="absolute right-2 top-2 flex gap-1 md:right-3 md:top-3 md:gap-2">
                      {course.isNew && (
                        <span className="rounded-full bg-green-500 px-1.5 py-0.5 text-[10px] font-medium text-white md:px-2 md:text-xs">
                          NEW
                        </span>
                      )}
                      {course.isHot && (
                        <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-medium text-white md:px-2 md:text-xs">
                          HOT
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-3 md:p-4">
                    <h3 className="mb-2 line-clamp-2 font-serif text-sm font-bold leading-5 text-text transition-colors group-hover:text-crimson md:text-base md:leading-6">
                      {course.title}
                    </h3>

                    {/* Info */}
                    <div className="mb-2 space-y-1 text-xs text-text-secondary md:mb-3 md:text-sm">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3 flex-shrink-0 text-crimson md:h-3.5 md:w-3.5" />
                        <span className="line-clamp-1">{course.dateRange}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3 flex-shrink-0 text-crimson md:h-3.5 md:w-3.5" />
                        <span className="line-clamp-1">{course.duration}</span>
                      </div>
                    </div>

                    {/* Price */}
                    <div className="flex flex-wrap items-baseline gap-1 md:gap-2">
                      <span className="text-base font-bold text-crimson md:text-lg">
                        ¥{course.price.toLocaleString()}
                      </span>
                      {course.originalPrice && (
                        <span className="text-xs text-text-muted line-through">
                          ¥{course.originalPrice.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </ScrollAnimation>
            );
          })}
        </div>

        {/* View All */}
        <ScrollAnimation>
          <div className="text-center">
            <Link
              href="/offline"
              className="inline-flex items-center gap-2 px-6 py-3 border-2 border-crimson text-crimson font-medium rounded-full hover:bg-crimson hover:text-white transition-all"
            >
              查看全部线下培训
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </ScrollAnimation>
      </div>
    </section>
  );
}
