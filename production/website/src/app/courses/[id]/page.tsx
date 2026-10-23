'use client';

import { CourseAccessLabel, useCourseAccess } from '@/components/CourseAccess';

import { usePageShare } from '@/components/PageShareData';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Calendar, Clock, User, Star, BookOpen, CheckCircle, Target, Sparkles,
  ChevronRight, Layers, Zap, GraduationCap, Award, Brain, ListVideo, PlayCircle,
} from 'lucide-react';
import ScrollAnimation from '@/components/ScrollAnimation';
import PlaceholderImage from '@/components/PlaceholderImage';
import { courseKnowledgeById, courses, type Course } from '@/config/courses';
import {
  courseRecordMatches,
  getCourseStatus,
  getPublicCourseName,
  PublicCourseRecord,
} from '@/lib/course-match';
import {
  getCourseVideoHref,
  getPlatformSeriesIdForLegacyCourse,
} from '@/lib/course-series-ids';
import { useEffect, useMemo, useState } from 'react';

function formatDateRange(record: PublicCourseRecord): string {
  if (record.startDate && record.endDate) return `${record.startDate} ~ ${record.endDate}`;
  return record.startDate || '时间待定';
}

function platformOfflineCourseToRecord(item: Course & {
  startDate?: string;
  endDate?: string;
  sessionName?: string;
  subType?: string;
}): PublicCourseRecord {
  return {
    id: item.id,
    name: item.title,
    officialCourseName: item.title,
    type: item.type,
    subType: item.sessionName || item.subType || '',
    scheduleLabel: item.sessionName || item.subType || '',
    startDate: item.startDate,
    endDate: item.endDate,
    price: item.price,
    sessions: Number.parseInt(item.duration, 10) || 0,
    teacher: item.instructor,
    content: item.description,
  };
}

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const shouldUsePlatform = searchParams.get('source') === 'platform';
  const routeCourseId = String(params.id || '');
  const staticCourse = shouldUsePlatform ? undefined : courses.find((c) => c.id === routeCourseId);
  const mappedPlatformSeriesId = getPlatformSeriesIdForLegacyCourse(routeCourseId);
  const requestedPlatformSeriesId = shouldUsePlatform
    ? (/^\d+$/.test(routeCourseId) && Number(routeCourseId) > 0 ? Number(routeCourseId) : null)
    : (mappedPlatformSeriesId ?? null);
  const courseAccess = useCourseAccess(requestedPlatformSeriesId);
  const [platformCourse, setPlatformCourse] = useState<Course | null>(null);
  const [platformResolved, setPlatformResolved] = useState(false);
  const course = platformCourse || staticCourse;
  usePageShare(course ? {
    title: course.title,
    desc: course.description || '查看课程介绍、导师与完整课程目录。',
    link: `/courses/${encodeURIComponent(String(params.id))}${shouldUsePlatform ? '?source=platform' : ''}`,
    imgUrl: course.image || '',
  } : null);

  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [enrollForm, setEnrollForm] = useState({ name: '', phone: '' });
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [enrollResult, setEnrollResult] = useState<{ success: boolean; message: string } | null>(null);
  const [courseRecords, setCourseRecords] = useState<PublicCourseRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadPlatformCourse() {
      setPlatformResolved(false);
      if (!requestedPlatformSeriesId) {
        setPlatformCourse(null);
        setPlatformResolved(true);
        return;
      }
      try {
        const res = await fetch(`/api/platform-courses/${requestedPlatformSeriesId}`, { cache: 'no-store' });
        const data = await res.json();
        if (mounted && data?.success) setPlatformCourse(data.data);
      } catch (error) {
        console.error('加载平台课程详情失败:', error);
      } finally {
        if (mounted) setPlatformResolved(true);
      }
    }

    loadPlatformCourse();
    return () => { mounted = false; };
  }, [requestedPlatformSeriesId]);

  useEffect(() => {
    if (course?.category !== 'offline') return;

    let mounted = true;

    async function loadCourseRecords() {
      setRecordsLoading(true);
      try {
        const res = await fetch('/api/platform-offline-courses', { cache: 'no-store' });
        const data = await res.json();
        if (!mounted) return;
        const rows = (Array.isArray(data) ? data : data.data || []) as Course[];
        setCourseRecords(rows.map(platformOfflineCourseToRecord));
      } catch (error) {
        console.error('加载课程期次失败:', error);
      } finally {
        if (mounted) setRecordsLoading(false);
      }
    }

    loadCourseRecords();
    return () => { mounted = false; };
  }, [course?.category]);

  const matchedRecords = useMemo(() => {
    if (course?.category !== 'offline') return [];
    return courseRecords
      .filter(record => courseRecordMatches(record, course))
      .sort((a, b) => String(a.startDate || '').localeCompare(String(b.startDate || '')));
  }, [course, courseRecords]);

  const handleEnroll = async () => {
    if (!enrollForm.name.trim() || !enrollForm.phone.trim()) {
      setEnrollResult({ success: false, message: '请填写姓名和手机号' });
      return;
    }
    setEnrollLoading(true);
    try {
      const res = await fetch('/api/public/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: enrollForm.name, phone: enrollForm.phone, courseId: params.id, channel: 'website' }),
      });
      const data = await res.json();
      if (data.success) {
        setEnrollResult({ success: true, message: `报名成功！课程：${data.data.courseName}` });
        setTimeout(() => setShowEnrollModal(false), 2000);
      } else {
        setEnrollResult({ success: false, message: data.error || '报名失败' });
      }
    } catch {
      setEnrollResult({ success: false, message: '网络错误，请稍后重试' });
    } finally {
      setEnrollLoading(false);
    }
  };

  if (!course && !platformResolved && (shouldUsePlatform || !staticCourse)) {
    return (
      <div className="pt-20 min-h-screen flex items-center justify-center">
        <div className="text-center text-text-secondary">课程详情加载中...</div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="pt-20 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-serif text-2xl font-bold text-text mb-4">课程不存在</h1>
          <button onClick={() => router.back()} className="text-gold hover:underline">返回上一页</button>
        </div>
      </div>
    );
  }

  // Extract module items and non-module items from outline
  const moduleItems = course.outline.filter(i => i.startsWith('【'));
  // Parse fullDescription into sections
  const descParagraphs = course.fullDescription.split('\n\n').filter(Boolean);
  const shortDesc = descParagraphs[0] || course.description;
  const detailDesc = descParagraphs.slice(1).join('\n\n');
  const platformMeta = course as Course & {
    legacyCourseId?: string;
    platformSeriesId?: number;
  };
  const courseKnowledge = courseKnowledgeById[String(platformMeta.legacyCourseId || course.id)];
  const courseVideoHref = getCourseVideoHref({
    courseId: course.id,
    legacyCourseId: platformMeta.legacyCourseId || routeCourseId,
    platformSeriesId: platformMeta.platformSeriesId,
  });

  const coreValues = [
    { icon: Brain, label: '系统科学', desc: courseKnowledge ? `对应 ${courseKnowledge.systems.slice(0, 2).join('、')} 等训练体系` : '科学系统的训练体系，打破碎片化学舞困境' },
    { icon: Layers, label: '全维覆盖', desc: `从基础到高阶，${course.duration}完整学习路径` },
    { icon: Zap, label: '精准解决', desc: courseKnowledge ? courseKnowledge.focus[0] : '理论+训练+应用，真正掌握并运用' },
    { icon: GraduationCap, label: '名师亲授', desc: `${course.instructor}亲自授课，多年教学经验倾囊相授` },
  ];

  const whoCanLearn = courseKnowledge?.suitableFor || [
    '零基础想系统学习东方舞的爱好者',
    '有一定基础但技巧不稳定的进阶舞者',
    '学习碎片化、缺乏完整知识体系的学员',
    '希望提升舞蹈表现力与高级感的舞者',
    '想要系统掌握教学能力的舞蹈教师',
  ];

  const learningOutcomes = courseKnowledge?.outcomes || [
    '建立完整的舞蹈知识与技能体系',
    '掌握核心技巧，提升舞蹈稳定性与高级感',
    '拥有独立编舞与音乐理解能力',
    '获得可直接用于教学的课程体系',
    '提升舞蹈表达力，走向国际舞台',
  ];

  return (
    <div className="pt-20 min-h-screen bg-warm-white">
      {/* ========== Hero Section ========== */}
      <section className="relative bg-gradient-to-br from-crimson-dark/10 via-gold/5 to-black/5 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(circle at 25% 25%, #c8a96e 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 lg:py-16">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Left: Text content */}
            <ScrollAnimation animation="slide-left">
              <div className="space-y-6">
                {/* Badges */}
                <div className="flex flex-wrap items-center gap-3">
                  {course.isNew && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-crimson text-white text-xs font-semibold rounded-full">
                      <Sparkles className="w-3 h-3" /> 新课上线
                    </span>
                  )}
                  {course.isHot && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-gold to-gold-dark text-white text-xs font-semibold rounded-full">
                      <Star className="w-3 h-3" /> 热门推荐
                    </span>
                  )}
                  <span className="px-3 py-1 bg-white/80 text-text-secondary text-xs font-medium rounded-full border border-sand/30">
                    {course.category === 'online' ? '线上录播' : course.type}
                  </span>
                </div>

                {/* Title */}
                <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-text leading-tight">
                  {course.title}
                </h1>

                {/* Subtitle / Tagline */}
                <p className="text-lg text-text-secondary leading-relaxed">
                  {course.description}
                </p>

                {/* Meta Info Row */}
                <div className="flex flex-wrap gap-x-6 gap-y-3">
                  <span className="flex items-center gap-2 text-sm text-text-secondary">
                    <User className="w-4 h-4 text-gold" />
                    <span className="font-medium">{course.instructor}</span>
                  </span>
                  <span className="flex items-center gap-2 text-sm text-text-secondary">
                    <Clock className="w-4 h-4 text-gold" />
                    <span className="font-medium">{course.duration}</span>
                    {course.displayStudents !== undefined && <span className="text-text-muted"> · {course.displayStudents}名学员</span>}
                  </span>
                  <span className="flex items-center gap-2 text-sm text-text-secondary">
                    <BookOpen className="w-4 h-4 text-gold" />
                    <span className="font-medium">{course.level}</span>
                  </span>
                </div>

                <CourseAccessLabel pricingConfirmed={Boolean(platformCourse)} seriesId={requestedPlatformSeriesId} price={course.price} originalPrice={course.originalPrice} />
                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  {course.category !== 'offline' && !courseAccess.unlocked && (
                    <Link
                      href={courseVideoHref}
                      className="px-8 py-3.5 bg-gradient-to-r from-gold to-gold-dark text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-gold/30 transition-all flex items-center justify-center gap-2 text-sm"
                    >
                      <PlayCircle className="h-4 w-4" />
                      {courseAccess.unlocked ? '继续学习' : '进入课程目录'}
                    </Link>
                  )}
                  <button
                    disabled={course.category !== 'offline' && (courseAccess.pending || courseAccess.unavailable)}
                    onClick={() => window.location.href = courseAccess.unlocked ? courseVideoHref : requestedPlatformSeriesId ? `/checkout/online/${requestedPlatformSeriesId}` : '/enroll'}
                    className="px-8 py-3.5 border-2 border-gold/40 text-gold-dark font-semibold rounded-xl hover:bg-gold/5 transition-all flex items-center justify-center gap-2 text-sm"
                  >
                    {courseAccess.unlocked ? '继续学习' : courseAccess.pending ? '正在查询学习权益…' : courseAccess.unavailable ? '暂无法确认学习权益' : '立即购买'}
                  </button>
                  <button
                    onClick={() => setShowEnrollModal(true)}
                    className="px-8 py-3.5 border-2 border-gold/40 text-gold-dark font-semibold rounded-xl hover:bg-gold/5 transition-all flex items-center justify-center gap-2 text-sm"
                  >
                    预约咨询
                  </button>
                </div>
              </div>
            </ScrollAnimation>

            {/* Right: Course Image */}
            <ScrollAnimation animation="slide-right">
              <div className="relative group">
                <div className="absolute -inset-2 bg-gradient-to-br from-gold/20 to-crimson/20 rounded-3xl blur-xl opacity-70 group-hover:opacity-100 transition-opacity" />
                <div className="relative overflow-hidden rounded-2xl shadow-xl aspect-[4/3]">
                  <PlaceholderImage
                    src={course.image}
                    alt={`${course.title} 课程封面`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                  {/* Play button */}
                  <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full">
                    <div className="w-6 h-6 bg-white/90 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-gold ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                    试看视频筹备中
                  </div>
                </div>
              </div>
            </ScrollAnimation>
          </div>
        </div>
      </section>

      {/* ========== Course Overview Section ========== */}
      <section className="py-12 md:py-16 bg-white border-b border-sand/20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-3 gap-8 lg:gap-12">
            {/* Main description */}
            <div className="lg:col-span-2">
              <ScrollAnimation>
                <h2 className="font-serif text-2xl md:text-3xl font-bold text-text mb-6">课程概述</h2>
              </ScrollAnimation>
              <div className="space-y-5 text-text-secondary leading-relaxed">
                <ScrollAnimation delay={100}>
                  <p className="text-base md:text-lg">{shortDesc}</p>
                </ScrollAnimation>
                {detailDesc && (
                  <>
                    {detailDesc.split('\n\n').filter(Boolean).map((para, i) => (
                      <ScrollAnimation key={i} delay={150 + i * 50}>
                        <p>{para}</p>
                      </ScrollAnimation>
                    ))}
                  </>
                )}
              </div>
            </div>

            {/* Quick Info Sidebar */}
            <div>
              <ScrollAnimation delay={200}>
                <div className="bg-warm-gray/50 rounded-2xl p-6 space-y-5">
                  <h3 className="font-serif font-bold text-lg text-text">课程信息</h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center flex-shrink-0">
                        <User className="w-5 h-5 text-gold" />
                      </div>
                      <div>
                        <p className="text-xs text-text-muted">授课讲师</p>
                        <p className="text-sm font-semibold text-text">{course.instructor}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Clock className="w-5 h-5 text-gold" />
                      </div>
                      <div>
                        <p className="text-xs text-text-muted">课程时长</p>
                        <p className="text-sm font-semibold text-text">{course.duration}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center flex-shrink-0">
                        <BookOpen className="w-5 h-5 text-gold" />
                      </div>
                      <div>
                        <p className="text-xs text-text-muted">适合人群</p>
                        <p className="text-sm font-semibold text-text">{course.level}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Layers className="w-5 h-5 text-gold" />
                      </div>
                      <div>
                        <p className="text-xs text-text-muted">学习形式</p>
                        <p className="text-sm font-semibold text-text">线上录播·永久回看</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Award className="w-5 h-5 text-gold" />
                      </div>
                      <div>
                        <p className="text-xs text-text-muted">适用场景</p>
                        <p className="text-sm font-semibold text-text">自修提升 / 教学参考</p>
                      </div>
                    </div>
                  </div>
                  <button
                    disabled={course.category !== 'offline' && (courseAccess.pending || courseAccess.unavailable)}
                    onClick={() => window.location.href = courseAccess.unlocked ? courseVideoHref : requestedPlatformSeriesId ? `/checkout/online/${requestedPlatformSeriesId}` : '/enroll'}
                    className="w-full py-2.5 bg-gradient-to-r from-gold to-gold-dark text-white font-medium rounded-xl hover:shadow-lg transition-all text-sm"
                  >
                    立即报名
                  </button>
                </div>
              </ScrollAnimation>
            </div>
          </div>
        </div>
      </section>

      {courseKnowledge && (
        <section className="py-12 md:py-16 bg-warm-white border-b border-sand/20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <ScrollAnimation>
              <div className="text-center mb-10">
                <span className="inline-block px-3 py-1 bg-gold/10 text-gold-dark text-sm font-medium rounded-full mb-4 border border-gold/20">
                  课程体系拆分
                </span>
                <h2 className="font-serif text-2xl md:text-3xl font-bold text-text mb-3">
                  这门课在 SWOD 系统里解决什么
                </h2>
                <p className="text-text-secondary max-w-2xl mx-auto">
                  每门课程都不是孤立内容，而是对应到具体能力体系、训练问题和阶段目标。
                </p>
              </div>
            </ScrollAnimation>

            <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-6">
              <ScrollAnimation animation="slide-left">
                <div className="bg-white rounded-2xl p-6 border border-sand/20 shadow-sm h-full">
                  <h3 className="font-serif text-xl font-bold text-text mb-4">对应体系</h3>
                  <div className="flex flex-wrap gap-2">
                    {courseKnowledge.systems.map((system) => (
                      <span key={system} className="px-3 py-1.5 bg-gold/10 text-gold-dark text-sm rounded-full border border-gold/20">
                        {system}
                      </span>
                    ))}
                  </div>
                </div>
              </ScrollAnimation>

              <ScrollAnimation animation="slide-right">
                <div className="bg-white rounded-2xl p-6 border border-sand/20 shadow-sm h-full">
                  <h3 className="font-serif text-xl font-bold text-text mb-4">重点解决</h3>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {courseKnowledge.focus.map((item) => (
                      <div key={item} className="flex items-start gap-2 rounded-xl bg-warm-gray/60 p-3">
                        <Target className="w-4 h-4 text-gold mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-text-secondary leading-relaxed">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </ScrollAnimation>
            </div>
          </div>
        </section>
      )}

      {/* ========== Core Values Section ========== */}
      <section className="py-12 md:py-16 bg-warm-white border-b border-sand/20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollAnimation>
            <div className="text-center mb-10">
              <h2 className="font-serif text-2xl md:text-3xl font-bold text-text mb-3">为什么选择这门课程</h2>
              <p className="text-text-secondary">{course.title} 的核心优势</p>
            </div>
          </ScrollAnimation>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {coreValues.map((v, i) => (
              <ScrollAnimation key={i} delay={i * 100}>
                <div className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow border border-sand/20 h-full">
                  <div className="w-12 h-12 bg-gold/10 rounded-xl flex items-center justify-center mb-4">
                    <v.icon className="w-6 h-6 text-gold" />
                  </div>
                  <h3 className="font-semibold text-text mb-2">{v.label}</h3>
                  <p className="text-sm text-text-secondary leading-relaxed">{v.desc}</p>
                </div>
              </ScrollAnimation>
            ))}
          </div>
        </div>
      </section>

      {/* ========== Suitable For Section ========== */}
      <section className="py-12 md:py-16 bg-white border-b border-sand/20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <ScrollAnimation animation="slide-left">
              <div>
                <h2 className="font-serif text-2xl md:text-3xl font-bold text-text mb-6">适合这样的你</h2>
                <ul className="space-y-4">
                  {whoCanLearn.map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                      </div>
                      <span className="text-text-secondary">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </ScrollAnimation>
            <ScrollAnimation animation="slide-right">
              <div className="relative">
                <div className="bg-gradient-to-br from-gold/10 to-crimson/5 rounded-3xl p-8">
                  <h3 className="font-serif font-bold text-xl text-text mb-4">学习收获</h3>
                  <ul className="space-y-4">
                    {learningOutcomes.map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <Target className="w-5 h-5 text-gold flex-shrink-0 mt-0.5" />
                        <span className="text-text-secondary">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </ScrollAnimation>
          </div>
        </div>
      </section>

      {/* ========== Course Outline (full expanded) ========== */}
      <section className="py-12 md:py-16 bg-warm-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollAnimation>
            <div className="text-center mb-10">
              <h2 className="font-serif text-2xl md:text-3xl font-bold text-text mb-3">课程大纲</h2>
              <p className="text-text-secondary">完整的学习路径，循序渐进掌握{course.title}</p>
            </div>
          </ScrollAnimation>

          <div className="space-y-3">
            {moduleItems.length > 0 ? (
              /* Module-style outline (with 【XX】 prefix) */
              moduleItems.map((item, i) => {
                const match = item.match(/^【(.+?)】(.+)/);
                const moduleTitle = match ? `【${match[1]}】` : '';
                const moduleDesc = match ? match[2].trim() : item;
                return (
                  <ScrollAnimation key={i} delay={i * 60}>
                    <div className="group bg-white rounded-xl shadow-sm hover:shadow-md hover:border-gold/30 transition-all border border-sand/20 overflow-hidden">
                      <div className="p-4 md:p-5 flex items-start gap-4">
                        <div className="flex-shrink-0 w-9 h-9 bg-gradient-to-br from-gold to-gold-dark rounded-lg flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                          <span className="text-white font-bold text-sm">{String(i + 1).padStart(2, '0')}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          {moduleTitle && (
                            <span className="inline-block text-xs font-bold text-gold-dark bg-gold/10 px-2 py-0.5 rounded mb-1.5">
                              {moduleTitle}
                            </span>
                          )}
                          <p className="text-text-secondary text-sm md:text-base leading-relaxed">{moduleDesc}</p>
                        </div>
                      </div>
                    </div>
                  </ScrollAnimation>
                );
              })
            ) : (
              /* Flat-style outline */
              course.outline.map((item, i) => (
                <ScrollAnimation key={i} delay={i * 60}>
                  <div className="flex items-start gap-4 p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-all border border-sand/20">
                    <div className="flex-shrink-0 w-8 h-8 bg-gold/10 rounded-full flex items-center justify-center">
                      <span className="text-gold-dark font-semibold text-sm">{i + 1}</span>
                    </div>
                    <div className="flex items-start gap-2 flex-1">
                      <CheckCircle className="w-5 h-5 text-gold flex-shrink-0 mt-0.5" />
                      <span className="text-text-secondary text-sm">{item}</span>
                    </div>
                  </div>
                </ScrollAnimation>
              ))
            )}
          </div>

          {/* Total lessons count */}
          <ScrollAnimation delay={course.outline.length * 60}>
            <div className="mt-8 text-center">
              <div className="inline-flex items-center gap-2 bg-gold/5 border border-gold/20 rounded-full px-6 py-3">
                <Layers className="w-5 h-5 text-gold" />
                <span className="text-text font-medium">
                  共 <span className="text-gold-dark font-bold">{course.outline.length}</span> 个模块 · <span className="text-gold-dark font-bold">{course.duration}</span>
                </span>
              </div>
              {course.category !== 'offline' && (
                <Link
                  href={courseVideoHref}
                  className="mx-auto mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold to-gold-dark px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-gold/20 transition-all hover:shadow-xl hover:shadow-gold/30"
                >
                  <ListVideo className="h-4 w-4" />
                  查看课程目录与课节视频
                </Link>
              )}
            </div>
          </ScrollAnimation>
        </div>
      </section>

      {course.category === 'offline' && (
        <section className="py-12 md:py-16 bg-white border-t border-sand/20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <ScrollAnimation>
              <div className="text-center mb-10">
                <h2 className="font-serif text-2xl md:text-3xl font-bold text-text mb-3">历届期次</h2>
                <Link
                  href="/offline/schedule"
                  className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-gold-dark hover:text-crimson transition-colors"
                >
                  查看课程日历 <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </ScrollAnimation>

            {recordsLoading ? (
              <div className="bg-warm-gray/50 rounded-xl border border-sand/20 p-8 text-center text-text-muted">
                正在同步期次记录...
              </div>
            ) : matchedRecords.length > 0 ? (
              <div className="space-y-3">
                {matchedRecords.map((record, index) => {
                  const status = getCourseStatus(record);
                  return (
                    <ScrollAnimation key={`${record.id}-${record.startDate || index}`} delay={index * 50}>
                      <div className="bg-warm-gray/50 rounded-xl border border-sand/20 p-4 md:p-5 shadow-sm hover:shadow-md transition-all">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <h3 className="font-semibold text-text">
                                {getPublicCourseName(record)}
                              </h3>
                              {record.scheduleLabel && (
                                <span className="px-2 py-0.5 rounded-full bg-gold/10 text-gold-dark text-xs font-medium">
                                  {record.scheduleLabel}
                                </span>
                              )}
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                status === 'ended'
                                  ? 'bg-gray-100 text-gray-600'
                                  : 'bg-crimson/10 text-crimson'
                              }`}>
                                {status === 'ended' ? '已结业' : '正在招募'}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-text-secondary">
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5 text-gold" />
                                {formatDateRange(record)}
                              </span>
                              {record.teacher && <span>授课：{record.teacher}</span>}
                              {record.sessions ? <span>{record.sessions}课次</span> : null}
                            </div>
                          </div>
                          <div className="text-left md:text-right">
                            {record.price ? (
                              <div className="text-lg font-bold text-crimson">¥{Number(record.price).toLocaleString('zh-CN')}</div>
                            ) : (
                              <div className="text-sm text-text-muted">价格待定</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </ScrollAnimation>
                  );
                })}
              </div>
            ) : (
              <div className="bg-warm-gray/50 rounded-xl border border-sand/20 p-8 text-center">
                <Calendar className="w-12 h-12 text-gold/50 mx-auto mb-3" />
                <p className="text-text font-medium mb-1">暂无匹配期次</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ========== Final CTA Section ========== */}
      <section className="py-16 md:py-20 bg-gradient-to-r from-gold to-gold-dark text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-64 h-64 bg-white rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl translate-x-1/3 translate-y-1/3" />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollAnimation>
            <h2 className="font-serif text-3xl md:text-4xl font-bold mb-4">
              准备好开始了吗？
            </h2>
            <p className="text-lg text-white/80 mb-8 max-w-2xl mx-auto">
              开启你的东方舞学习之旅，让每一个动作都更有力量，每一段舞蹈都更有灵魂
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                disabled={course.category !== 'offline' && (courseAccess.pending || courseAccess.unavailable)}
                    onClick={() => window.location.href = courseAccess.unlocked ? courseVideoHref : requestedPlatformSeriesId ? `/checkout/online/${requestedPlatformSeriesId}` : '/enroll'}
                className="px-10 py-4 bg-white text-gold-dark font-bold rounded-xl hover:shadow-xl hover:shadow-white/20 transition-all text-base"
              >
                {courseAccess.unlocked ? '继续学习' : courseAccess.pending ? '正在查询学习权益…' : courseAccess.unavailable ? '暂无法确认学习权益' : '立即购买'}
              </button>
              <button
                onClick={() => setShowEnrollModal(true)}
                className="px-10 py-4 border-2 border-white/40 text-white font-semibold rounded-xl hover:bg-white/10 transition-all text-base"
              >
                预约咨询
              </button>
            </div>
          </ScrollAnimation>
        </div>
      </section>

      {/* Enroll Modal */}
      {showEnrollModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="font-serif text-xl font-bold text-text mb-2">预约咨询</h3>
            <p className="text-text-secondary text-sm mb-6">课程：{course.title}</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-text-secondary mb-1">姓名</label>
                <input
                  type="text"
                  value={enrollForm.name}
                  onChange={(e) => setEnrollForm({ ...enrollForm, name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-sand/50 rounded-xl focus:ring-2 focus:ring-gold focus:border-transparent outline-none"
                  placeholder="请输入姓名"
                />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">手机号</label>
                <input
                  type="tel"
                  value={enrollForm.phone}
                  onChange={(e) => setEnrollForm({ ...enrollForm, phone: e.target.value })}
                  className="w-full px-4 py-2.5 border border-sand/50 rounded-xl focus:ring-2 focus:ring-gold focus:border-transparent outline-none"
                  placeholder="请输入手机号"
                />
              </div>
            </div>
            {enrollResult && (
              <div className={`mt-4 p-3 rounded-xl text-sm ${enrollResult.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {enrollResult.message}
              </div>
            )}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowEnrollModal(false); setEnrollResult(null); }}
                className="flex-1 px-4 py-2.5 border border-sand/50 rounded-xl hover:bg-gray-50 text-text-secondary transition-colors text-sm"
              >
                取消
              </button>
              <button
                onClick={handleEnroll}
                disabled={enrollLoading}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-gold to-gold-dark text-white rounded-xl hover:shadow-lg disabled:opacity-50 transition-all text-sm font-medium"
              >
                {enrollLoading ? '提交中…' : '提交预约'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Back to Top */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-6 right-6 z-40 w-12 h-12 bg-gold text-white rounded-full shadow-lg flex items-center justify-center hover:bg-gold-dark hover:shadow-xl transition-all hover:scale-105"
      >
        <ArrowLeft className="w-5 h-5 rotate-90" />
      </button>
    </div>
  );
}
