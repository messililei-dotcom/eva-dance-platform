import Link from 'next/link';
import { Calendar, Clock, MapPin, ArrowRight, Users, Award, GraduationCap } from 'lucide-react';
import { courses } from '@/config/courses';
import ScrollAnimation from '@/components/ScrollAnimation';
import SectionHeader from '@/components/SectionHeader';

const offlineCourses = courses.filter(c => c.category === 'offline');

const typeLabels: Record<string, string> = {
  bootcamp: '集训营',
  cert: '师资认证班',
  private: '私教1对1',
  enterprise: '企业定制',
};

const levelColors: Record<string, string> = {
  基础: 'bg-blue-100 text-blue-700',
  基础进阶: 'bg-cyan-100 text-cyan-700',
  中级: 'bg-yellow-100 text-yellow-700',
  中阶: 'bg-yellow-100 text-yellow-700',
  '中阶-高阶': 'bg-orange-100 text-orange-700',
  中高阶: 'bg-orange-100 text-orange-700',
  高级: 'bg-red-100 text-red-700',
  高阶: 'bg-red-100 text-red-700',
};

export default function OfflineCoursesSection() {
  return (
    <section className="py-10 md:py-14 bg-gradient-to-b from-white via-warm-white/30 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <ScrollAnimation>
          <SectionHeader
            number="05"
            icon={GraduationCap}
            badge="线下培训"
            title="线下培训 & 师资认证"
            subtitle="沉浸式学习体验，国际名师面对面指导，从爱好者到专业教师的蜕变之路"
          />
        </ScrollAnimation>

        {/* 培训特色 */}
        <ScrollAnimation delay={100}>
          <div className="mb-8 p-4 bg-gradient-to-r from-crimson/5 to-transparent rounded-xl border border-crimson/10">
            <div className="flex flex-wrap gap-4 justify-center">
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

        {/* Course Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {offlineCourses.slice(0, 6).map((course, index) => {
            const typeLabel = typeLabels[course.type] || course.type;
            const levelColor = levelColors[course.level] || 'bg-gray-100 text-gray-700';

            return (
              <ScrollAnimation key={course.id} delay={index * 80}>
                <Link
                  href={`/offline/${course.id}`}
                  className="group block bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border border-sand/20 hover:border-crimson/40 h-full flex flex-col"
                >
                  {/* Badge Row */}
                  <div className="flex gap-2 p-4 pb-0">
                    <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${levelColor}`}>
                      {course.level}
                    </span>
                    <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-crimson/10 text-crimson">
                      {typeLabel}
                    </span>
                    {course.isNew && (
                      <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">
                        NEW
                      </span>
                    )}
                    {course.isHot && (
                      <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-600">
                        HOT
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-4 flex-1 flex flex-col">
                    {/* Title */}
                    <h3 className="font-serif text-lg font-bold text-text mb-2 group-hover:text-crimson transition-colors line-clamp-2">
                      {course.title}
                    </h3>

                    {/* Instructor */}
                    <p className="text-sm text-text-muted mb-3">
                      👤 {course.instructor}
                    </p>

                    {/* Info Grid */}
                    <div className="space-y-2 mb-4 text-sm text-text-secondary">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-crimson flex-shrink-0" />
                        <span>{course.dateRange}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-crimson flex-shrink-0" />
                        <span>{course.duration}</span>
                      </div>
                    </div>

                    {/* Price */}
                    <div className="mt-auto pt-4 border-t border-sand/20">
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-crimson">
                          ¥{course.price.toLocaleString()}
                        </span>
                        {course.originalPrice && (
                          <span className="text-sm text-text-muted line-through">
                            ¥{course.originalPrice.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* CTA Footer */}
                  <div className="px-4 pb-4">
                    <div className="flex items-center gap-2 text-crimson font-medium text-sm group-hover:gap-3 transition-all">
                      <span>了解详情</span>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </Link>
              </ScrollAnimation>
            );
          })}
        </div>

        {/* View All Link */}
        <ScrollAnimation>
          <div className="text-center mt-10">
            <Link
              href="/offline"
              className="inline-flex items-center gap-2 px-6 py-3 border-2 border-crimson text-crimson font-medium rounded-full hover:bg-crimson hover:text-white transition-all"
            >
              查看全部线下培训 <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </ScrollAnimation>
      </div>
    </section>
  );
}