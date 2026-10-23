"use client";
import { CourseAccessLabel, courseSeriesId, useCourseAccess } from './CourseAccess';
import { Clock, User, Star } from 'lucide-react';
import { type Course } from '@/config/courses';
import PlaceholderImage from './PlaceholderImage';
import { cn } from '@/lib/utils';
import { getCourseVideoHref } from '@/lib/course-series-ids';

interface CourseCardProps {
  course: Course;
  variant?: 'default' | 'compact' | 'featured' | 'dance-style';
}

export default function CourseCard({ course, variant = 'default' }: CourseCardProps) {
  const accessId = courseSeriesId(course);
  const access = useCourseAccess(accessId);
  const priceLine = <CourseAccessLabel pricingConfirmed={Boolean((course as Course & { platformSeriesId?: number }).platformSeriesId)} seriesId={accessId} price={course.price} originalPrice={course.originalPrice} />;
  const platformMeta = course as Course & { legacyCourseId?: string; platformSeriesId?: number; platformCourseId?: number };
  const isPlatformCourse = Boolean(platformMeta.platformSeriesId || platformMeta.platformCourseId);
  const resolvedCourseId = isPlatformCourse ? course.id : (platformMeta.legacyCourseId || course.id);
  const needsPlatformSource = isPlatformCourse;
  const sourceQuery = needsPlatformSource ? '?source=platform' : '';
  const courseHref = course.category === 'offline'
    ? `/offline/${resolvedCourseId}${sourceQuery}`
    : `/courses/${resolvedCourseId}${sourceQuery}`;
  const mobileVideoHref = getCourseVideoHref({
    courseId: resolvedCourseId,
    legacyCourseId: platformMeta.legacyCourseId,
    platformSeriesId: platformMeta.platformSeriesId || platformMeta.platformCourseId,
  });
  const shouldOpenVideoOnMobile = course.category === 'online' || course.category === 'dance-collection';

  const studentCount = course.displayStudents !== undefined ? <p className="mt-2 text-xs text-text-muted">{course.displayStudents}名学员</p> : null;

  if (variant === 'dance-style') {
    const cardContent = (
      <>
        {/* Image - course covers are displayed as 4:3 landscape across platforms. */}
        <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-gold-50 to-crimson-50">
          <PlaceholderImage src={course.image} alt={course.title} className="group-hover:scale-105 transition-transform duration-500" />
          {/* Badges */}
          <div className="absolute left-2 top-2 flex gap-1.5 md:left-3 md:top-3 md:gap-2">
            {course.isNew && (
              <span className="rounded-md bg-crimson px-1.5 py-0.5 text-[10px] font-bold text-white shadow-md md:px-2 md:py-1 md:text-xs">
                NEW
              </span>
            )}
            {course.isHot && (
              <span className="rounded-md bg-gradient-to-r from-gold to-gold-dark px-1.5 py-0.5 text-[10px] font-bold text-white shadow-md md:px-2 md:py-1 md:text-xs">
                HOT
              </span>
            )}
          </div>
          {/* Overlay on hover */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all duration-300 flex items-center justify-center">
            <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform group-hover:scale-100 scale-90">
              <span className="w-5 h-5 text-gold-dark ml-0.5">▶</span>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="p-3 md:p-4">
          <h3 className="mb-1 line-clamp-1 text-xs font-semibold text-text-primary md:text-sm">
            {course.title}
          </h3>
          <p className="mb-2 line-clamp-2 text-[11px] leading-4 text-text-secondary md:mb-3 md:text-xs md:leading-5">
            {course.description}
          </p>
          {studentCount}{priceLine}{access.unlocked && <span className="ml-2 text-sm font-medium text-green-700">继续学习</span>}
          <div className="flex items-center justify-between gap-2">
            <span className="rounded-full bg-sand/50 px-1.5 py-0.5 text-[10px] text-gold-dark md:px-2 md:text-xs">
              {course.level}
            </span>
            <span className="flex min-w-0 items-center gap-1 truncate text-[10px] text-text-muted md:text-xs">
              <Clock className="h-3 w-3 shrink-0" />{course.duration}
            </span>
          </div>
        </div>
      </>
    );

    if (!shouldOpenVideoOnMobile) {
      return (
        <a href={access.unlocked ? mobileVideoHref : courseHref} className="group block overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:border-gold/30 hover:shadow-xl">
          {cardContent}
        </a>
      );
    }

    return (
      <>
        <a href={mobileVideoHref} className="group block overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:border-gold/30 hover:shadow-xl md:hidden">
          {cardContent}
        </a>
        <a href={access.unlocked ? mobileVideoHref : courseHref} className="group hidden overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:border-gold/30 hover:shadow-xl md:block">
          {cardContent}
        </a>
      </>
    );
  }

  if (variant === 'featured') {
    return (
      <div className="group relative bg-white rounded-2xl overflow-hidden shadow-md card-hover">
        <div className="grid md:grid-cols-2 gap-0">
          <div className="aspect-[4/3] md:h-full md:min-h-[280px]">
            <PlaceholderImage
              src={course.image}
              alt={course.title}
              className="group-hover:scale-105 transition-transform duration-500"
            />
          </div>
          <div className="p-6 md:p-8 flex flex-col justify-center">
            {course.isNew && (
              <span className="inline-flex items-center px-2.5 py-1 bg-crimson text-white text-xs font-medium rounded-full w-fit mb-3">
                新课
              </span>
            )}
            {course.isHot && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-gold to-gold-dark text-white text-xs font-medium rounded-full w-fit mb-3">
                <Star className="w-3 h-3" /> 热门
              </span>
            )}
            <h3 className="font-serif text-xl md:text-2xl font-bold text-text mb-3">
              {course.title}
            </h3>
            <p className="text-text-secondary text-sm mb-4 line-clamp-2">
              {course.description}
            </p>
            <div className="flex items-center gap-4 text-sm text-text-muted mb-6">
              <span className="flex items-center gap-1"><User className="w-4 h-4" />{course.instructor}</span>
              <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{course.duration}</span>
            </div>
            {studentCount}{priceLine}{access.unlocked && <span className="ml-2 text-sm font-medium text-green-700">继续学习</span>}
          <div className="flex items-center justify-between">
              <div className="text-gold-dark text-sm font-medium">
                咨询课程详情
              </div>
              {shouldOpenVideoOnMobile ? (
                <>
                  <a
                    href={mobileVideoHref}
                    className="px-5 py-2.5 bg-gradient-to-r from-gold to-gold-dark text-white text-sm font-medium rounded-lg hover:shadow-lg hover:shadow-gold/30 transition-all md:hidden"
                  >
                    {access.unlocked ? '继续学习' : '了解详情'}
                  </a>
                  <a
                    href={access.unlocked ? mobileVideoHref : courseHref}
                    className="hidden px-5 py-2.5 bg-gradient-to-r from-gold to-gold-dark text-white text-sm font-medium rounded-lg hover:shadow-lg hover:shadow-gold/30 transition-all md:inline-flex"
                  >
                    {access.unlocked ? '继续学习' : '了解详情'}
                  </a>
                </>
              ) : (
                <a
                  href={access.unlocked ? mobileVideoHref : courseHref}
                  className="px-5 py-2.5 bg-gradient-to-r from-gold to-gold-dark text-white text-sm font-medium rounded-lg hover:shadow-lg hover:shadow-gold/30 transition-all"
                >
                  {access.unlocked ? '继续学习' : '了解详情'}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className="group bg-white rounded-xl overflow-hidden shadow-sm card-hover">
        <div className="aspect-[4/3] overflow-hidden">
          <PlaceholderImage src={course.image} alt={course.title} />
        </div>
        <div className="p-4">
          <h3 className="font-serif font-semibold text-text mb-1 truncate">{course.title}</h3>
          <p className="text-xs text-text-muted mb-2 line-clamp-1">{course.description}</p>
          {studentCount}{priceLine}{access.unlocked && <span className="ml-2 text-sm font-medium text-green-700">继续学习</span>}
          <div className="flex items-center justify-between">
            <span className="text-gold-dark text-sm font-medium">
              咨询课程
            </span>
            {shouldOpenVideoOnMobile ? (
              <>
                <a href={mobileVideoHref} className="text-sm text-gold hover:text-gold-dark font-medium md:hidden">
                  {access.unlocked ? '继续学习' : '详情 →'}
                </a>
                <a href={access.unlocked ? mobileVideoHref : courseHref} className="hidden text-sm text-gold hover:text-gold-dark font-medium md:inline">
                  {access.unlocked ? '继续学习' : '详情 →'}
                </a>
              </>
            ) : (
              <a href={access.unlocked ? mobileVideoHref : courseHref} className="text-sm text-gold hover:text-gold-dark font-medium">
                {access.unlocked ? '继续学习' : '详情 →'}
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group bg-white rounded-2xl overflow-hidden shadow-md card-hover">
      <div className="relative aspect-[4/3] overflow-hidden">
        <PlaceholderImage src={course.image} alt={course.title} className="group-hover:scale-105 transition-transform duration-500" />
        <div className="absolute top-3 left-3 flex gap-2">
          {course.isNew && (
            <span className="px-2.5 py-1 bg-crimson text-white text-xs font-medium rounded-full">
              新课
            </span>
          )}
          {course.isHot && (
            <span className="px-2.5 py-1 bg-gradient-to-r from-gold to-gold-dark text-white text-xs font-medium rounded-full flex items-center gap-1">
              <Star className="w-3 h-3" /> 热门
            </span>
          )}
        </div>
      </div>
      <div className="p-5">
        <h3 className="font-serif font-semibold text-lg text-text mb-2 line-clamp-2">{course.title}</h3>
        <p className="text-sm text-text-secondary mb-3 line-clamp-2">{course.description}</p>
        <div className="flex items-center gap-4 text-xs text-text-muted mb-4">
          <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" />{course.instructor}</span>
          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{course.duration}</span>
          <span className="px-2 py-0.5 bg-sand/50 text-gold-dark rounded-full">{course.level}</span>
        </div>
        {studentCount}{priceLine}
        <div className="flex items-center justify-between pt-3 border-t border-sand/30">
          <div className="text-gold-dark text-sm font-medium">
            咨询课程详情
          </div>
          {shouldOpenVideoOnMobile ? (
            <>
              <a
                href={mobileVideoHref}
                className="px-4 py-2 bg-gold text-white text-sm font-medium rounded-lg hover:bg-gold-dark transition-colors md:hidden"
              >
                {access.unlocked ? '继续学习' : '了解详情'}
              </a>
              <a
                href={access.unlocked ? mobileVideoHref : courseHref}
                className="hidden px-4 py-2 bg-gold text-white text-sm font-medium rounded-lg hover:bg-gold-dark transition-colors md:inline-flex"
              >
                {access.unlocked ? '继续学习' : '了解详情'}
              </a>
            </>
          ) : (
            <a
              href={access.unlocked ? mobileVideoHref : courseHref}
              className="px-4 py-2 bg-gold text-white text-sm font-medium rounded-lg hover:bg-gold-dark transition-colors"
            >
              {access.unlocked ? '继续学习' : '了解详情'}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
