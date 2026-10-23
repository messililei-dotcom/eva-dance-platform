'use client';

import { notFound, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import {
  Calendar, Clock, MapPin, Users, Award, ArrowLeft, Phone,
  CheckCircle, Star, ChevronRight, Target, Sparkles, Layers,
  GraduationCap, Brain, Zap, User, Headphones, PhoneCall, X,
} from 'lucide-react';
import { Course, courses } from '@/config/courses';
import {
  courseRecordMatches,
  findBestCourseMatch,
  getCourseStatus,
  getPublicCourseName,
  PublicCourseRecord,
} from '@/lib/course-match';
import ScrollAnimation from '@/components/ScrollAnimation';
import PlaceholderImage from '@/components/PlaceholderImage';

const typeLabels: Record<string, string> = {
  bootcamp: '集训营',
  certification: '认证班',
  masterclass: '大师班',
  private: '私教',
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

const customerServiceQRCodes = [
  { name: 'Monica 海艳老师', src: '/images/contact/wechat-monica-haiyan.jpg', note: '课程咨询' },
  { name: 'Elin 伊琳老师', src: '/images/contact/wechat-elin-yilin.jpg', note: '报名咨询' },
];

const customerServicePhones = [
  { name: '海艳老师', phone: '+8615367870529', display: '153 6787 0529' },
  { name: '伊琳老师', phone: '+8619310029982', display: '193 1002 9982' },
];

const platformCourseIntroOverrides: Record<string, Partial<Course>> = {
  '267': {
    title: '传承弟子班内训课',
    description: '以东方舞完整技巧体系为核心，融合多舞种、多体系与作品训练的长期综合内训',
    fullDescription: '传承弟子班内训课是伊娃老师为传承弟子设置的长期综合训练课程。课程以东方舞完整技巧体系为核心，在基本功、高级技巧、复合技巧与技巧融合的基础上，持续吸收多舞种、多体系训练，拓宽弟子的身体能力、舞蹈语言与艺术表现力。\n\n训练涵盖爵士舞、中国舞、古典舞、现代舞、民族民间舞、探戈等舞种，并结合剑技、水袖、纱巾、藤杖、扇、长绸等专项内容。课程不以项目堆叠为目的，而是强调不同元素与东方舞技巧、音乐、空间和作品表达的融合运用。\n\n课程核心：东方舞为根 · 多舞种为养 · 技巧为器 · 融合为用 · 舞蹈为最终表达。通过长期、多元、系统的内训，帮助弟子逐步建立全面、成熟的综合舞蹈能力。',
    level: '传承弟子',
    outline: [
      '【东方舞核心体系】系统训练基本功、完整技巧、高级技巧、复合技巧、技巧叠加与融合运用',
      '【多舞种综合训练】吸收爵士舞、中国舞、古典舞、现代舞、民族民间舞、探戈等训练体系，丰富身体语言与艺术表现',
      '【道具与专项融合】结合剑技、水袖、纱巾、藤杖、扇、长绸等专项训练，强调道具与身体、音乐及空间的整体配合',
      '【融舞与作品表达】把东方舞技巧、多舞种元素、音乐、情绪和舞台表现融入完整作品，提升舞感与舞台驾驭能力',
    ],
  },
  '266': {
    title: '“首席舞蹈巨星专场”埃及大师Tito Seif“嫡系”乐队系统大师营',
    description: 'Tito Seif亲设课程，五天沉浸式学习经典编舞、埃及民俗舞与现场乐队即兴表演',
    fullDescription: '“首席舞蹈巨星专场”埃及大师 Tito Seif“嫡系”乐队系统大师营。\n\n课程地点：中国·长沙｜开课时间：2026年12月23日至12月27日｜主办单位：伊娃东方舞国际学院。\n\n本期课程由 Tito Seif 老师全程设定，课程内容精选他的个人风格编舞 Mejance、Classic Song、Baladi、Shaabi 等经典作品全拆解，并对埃及民俗舞两类风格进行系统精讲。\n\n课程将揭秘现场乐队即兴表演中的高阶配合技巧，分享与每位演奏者同频共振的独家经验，通过全风格乐队曲目密集训练完成实战演练。\n\n本期课程是一站式的封顶技术交流与分享，让学员近距离感受埃及顶级大师的风范，体验世界唯一的长时间沉浸式系统教学。',
    level: '大师营',
    outline: [
      '【经典编舞】Mejance、Classic Song、Baladi、Shaabi 等 Tito Seif 个人风格作品全拆解',
      '【民俗舞精讲】埃及民俗舞两类风格的系统训练与表达',
      '【乐队即兴】现场乐队高阶配合技巧与演奏者同频共振经验',
      '【第一节课｜14:00–17:00】3小时 CD 成品舞教学',
      '【第二节课｜17:30–18:30】1小时乐队即兴经验与教学分享',
      '【乐队工作安排｜17:30–18:30】配合 Tito 老师进行1小时现场乐队演奏',
      '【晚间实战｜20:00–23:00】学员刷曲练习与现场即兴演奏',
    ],
    isNew: true,
    isHot: true,
  },
};

function buildCourseFromRecord(record: PublicCourseRecord): Course {
  const title = getPublicCourseName(record);
  const start = record.startDate || '';
  const end = record.endDate || '';
  return {
    id: String(record.id),
    title,
    description: record.content || `${title} 课程详情`,
    fullDescription: record.content || `${title}，具体课程安排以开课通知为准。`,
    price: Number(record.price || 0),
    image: '/images/courses/placeholder-course.svg',
    category: 'offline',
    type: record.type || 'bootcamp',
    instructor: record.teacher || '伊娃老师',
    duration: record.sessions ? `${record.sessions}课次` : '以实际安排为准',
    level: '全级别',
    outline: record.content ? [record.content] : ['课程内容以教学通知为准'],
    dateRange: start && end ? `${start} ~ ${end}` : start || '待定',
  };
}

function formatDateRange(record: PublicCourseRecord): string {
  if (record.startDate && record.endDate && record.endDate >= record.startDate) {
    return `${record.startDate} ~ ${record.endDate}`;
  }
  return record.startDate ? `${record.startDate} 起` : '时间待定';
}

function getCoursePeriodSortValue(record: PublicCourseRecord): number {
  const startDate = String(record.startDate || '');
  const normalizedDate = Number(startDate.replace(/\D/g, '').slice(0, 8));
  if (normalizedDate >= 10000101) return normalizedDate;

  const label = String(record.scheduleLabel || record.subType || record.name || '');
  const year = Number(label.match(/(20\d{2})年?/)?.[1] || 0);
  const periodText = label.match(/第([^期]+)期/)?.[1] || '';
  const periodNumber = Number(periodText)
    || ({ '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6 }[periodText] || 0);

  return year * 10_000 + periodNumber * 100;
}

function getSessionCourseName(record: PublicCourseRecord): string {
  const raw = record.subType || record.scheduleLabel || '';
  const normalized = raw.replace(/^(\d{4})年*(.*)$/, '$1年$2').replace(/年{2,}/g, '年');
  return normalized || record.officialCourseName || record.name || getPublicCourseName(record);
}

export default function OfflineCoursePage() {
  const params = useParams();
  const courseId = String(params.id || '');
  const searchParams = useSearchParams();
  const shouldUsePlatform = searchParams.get('source') === 'platform';
  const staticCourse = courses.find((c) => c.id === courseId && c.category === 'offline');
  const [platformCourse, setPlatformCourse] = useState<Course | null>(null);
  const [sourceCourse, setSourceCourse] = useState<PublicCourseRecord | null>(null);
  const [courseRecords, setCourseRecords] = useState<PublicCourseRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadCourseRecords() {
      setRecordsLoading(true);
      try {
        const [listRes, detailRes] = await Promise.all([
          fetch('/api/platform-offline-courses', { cache: 'no-store' }),
          staticCourse || shouldUsePlatform ? Promise.resolve(null) : fetch(`/api/platform-offline-courses/${courseId}`, { cache: 'no-store' }),
        ]);
        const listData = await listRes.json();
        const detailData = detailRes ? await detailRes.json() : null;

        if (!mounted) return;
        const records = Array.isArray(listData) ? listData : listData.data || [];
        const platform = records.find((item: Course) => String(item.id) === courseId) || null;
        if (shouldUsePlatform) setPlatformCourse(platform);
        setCourseRecords(records.map((item: Course & {
          startDate?: string;
          endDate?: string;
          subType?: string;
          sessionName?: string;
          scheduleLabel?: string;
          officialMatchKey?: string;
          platformStatus?: string;
          location?: string;
          capacity?: number;
          remaining?: number;
        }) => ({
            id: item.id,
            name: item.title,
            officialCourseName: item.title,
            officialMatchKey: item.officialMatchKey,
            type: item.type,
            subType: item.sessionName || item.subType || item.scheduleLabel || '',
            scheduleLabel: item.sessionName || item.subType || item.scheduleLabel || '',
            startDate: item.startDate,
            endDate: item.endDate,
            price: item.price,
            sessions: Number.parseInt(item.duration, 10) || 0,
            teacher: item.instructor,
            content: item.description,
            status: item.platformStatus,
            location: item.location,
            capacity: item.capacity,
            remaining: item.remaining,
        })));
        if (!shouldUsePlatform && !staticCourse) {
          const detailCourse = detailData?.success ? detailData.data as Course : platform;
          setSourceCourse(detailCourse ? {
            id: detailCourse.id,
            name: detailCourse.title,
            officialCourseName: detailCourse.title,
            type: detailCourse.type,
            price: detailCourse.price,
            sessions: Number.parseInt(detailCourse.duration, 10) || 0,
            teacher: detailCourse.instructor,
            content: detailCourse.description,
          } : null);
        }
      } catch (error) {
        console.error('加载课程期次失败:', error);
      } finally {
        if (mounted) setRecordsLoading(false);
      }
    }

    loadCourseRecords();
    return () => { mounted = false; };
  }, [courseId, staticCourse, shouldUsePlatform]);

  const course = useMemo(() => {
    const resolvedCourse = platformCourse
      || staticCourse
      || (sourceCourse ? findBestCourseMatch(getPublicCourseName(sourceCourse), courses) || buildCourseFromRecord(sourceCourse) : null);
    const introOverride = platformCourseIntroOverrides[courseId];
    return resolvedCourse && introOverride ? { ...resolvedCourse, ...introOverride } : resolvedCourse;
  }, [courseId, platformCourse, sourceCourse, staticCourse]);

  const matchedRecords = useMemo(() => {
    if (!course) return [];
    return courseRecords
      .filter(record => courseRecordMatches(record, course))
      .sort((a, b) => {
        const timeOrder = getCoursePeriodSortValue(b) - getCoursePeriodSortValue(a);
        if (timeOrder) return timeOrder;
        return String(b.id).localeCompare(String(a.id), 'zh-CN', { numeric: true });
      });
  }, [course, courseRecords, shouldUsePlatform]);

  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);

  if (!course && !recordsLoading) notFound();

  if (!course) {
    return (
      <div className="min-h-screen bg-warm-white pt-32 text-center text-text-secondary">
        正在匹配课程详情...
      </div>
    );
  }

  const typeLabel = typeLabels[course.type] || course.type;
  const levelColor = levelColors[course.level] || 'bg-gray-100 text-gray-700';
  const courseLocation = (course as Course & { location?: string }).location || '湖南·长沙';
  const graduationReportHref = courseId === '20'
    ? '/dance-circle/2026-swod-technique-bootcamp-graduation'
    : courseId === '22'
      ? '/events/2026-mentor-class-graduation'
      : shouldUsePlatform && courseId === '123'
        ? '/dance-circle/alida-2026-graduation'
        : null;

  const descParagraphs = course.fullDescription.split('\n\n').filter(Boolean);
  const shortDesc = descParagraphs[0] || course.description;
  const detailDesc = descParagraphs.slice(1).join('\n\n');

  const moduleItems = course.outline.filter(i => i.startsWith('【'));

  const coreValues = [
    { icon: Brain, label: '名师亲授', desc: `${course.instructor} 亲自授课，多年一线教学经验` },
    { icon: Layers, label: '系统教学', desc: '科学系统的课程体系，从理论到实践全方位提升' },
    { icon: Users, label: '小班教学', desc: '控制班级人数，确保每位学员得到充分指导' },
    { icon: Award, label: '认证证书', desc: '完成课程并通过考核，获得官方认证证书' },
  ];

  return (
    <div className="min-h-screen bg-warm-white">
      {/* ========== Hero Section ========== */}
      <section className="relative bg-gradient-to-br from-crimson-dark/10 via-gold/5 to-black/5 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(circle at 25% 25%, #c8a96e 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 lg:py-16">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Left: Text content */}
            <ScrollAnimation animation="slide-left" className="order-2 lg:order-1">
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
                  <span className={`px-3 py-1 text-xs font-semibold rounded-full ${levelColor}`}>
                    {course.level}
                  </span>
                  <span className="px-3 py-1 bg-white/80 text-text-secondary text-xs font-medium rounded-full border border-sand/30">
                    {typeLabel}
                  </span>
                </div>

                {/* Title */}
                <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-text leading-tight">
                  {course.title}
                </h1>

                {/* Subtitle */}
                <p className="text-lg text-text-secondary leading-relaxed">
                  {course.description}
                </p>

                {/* Meta Info Cards */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gold/5 rounded-xl p-3 border border-gold/10">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-4 h-4 text-gold" />
                      <div>
                        <p className="text-xs text-text-muted">上课时间</p>
                        <p className="text-sm font-semibold text-text">{course.dateRange || '待定'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gold/5 rounded-xl p-3 border border-gold/10">
                    <div className="flex items-center gap-3">
                      <Clock className="w-4 h-4 text-gold" />
                      <div>
                        <p className="text-xs text-text-muted">课程时长</p>
                        <p className="text-sm font-semibold text-text">{course.duration}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gold/5 rounded-xl p-3 border border-gold/10">
                    <div className="flex items-center gap-3">
                      <User className="w-4 h-4 text-gold" />
                      <div>
                        <p className="text-xs text-text-muted">授课老师</p>
                        <p className="text-sm font-semibold text-text">{course.instructor}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gold/5 rounded-xl p-3 border border-gold/10">
                    <div className="flex items-center gap-3">
                      <MapPin className="w-4 h-4 text-gold" />
                      <div>
                        <p className="text-xs text-text-muted">上课地点</p>
                        <p className="text-sm font-semibold text-text">{courseLocation}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    onClick={() => setShowServiceModal(true)}
                    className="px-8 py-3.5 bg-gradient-to-r from-gold to-gold-dark text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-gold/30 transition-all flex items-center justify-center gap-2 text-sm"
                  >
                    <Phone className="w-4 h-4" /> 预约咨询
                  </button>
                  <Link
                    href={graduationReportHref || '/contact'}
                    className="px-8 py-3.5 border-2 border-gold/40 text-gold-dark font-semibold rounded-xl hover:bg-gold/5 transition-all flex items-center justify-center gap-2 text-sm"
                  >
                    {graduationReportHref ? '学员结业汇报' : '了解更多'}
                  </Link>
                </div>
              </div>
            </ScrollAnimation>

            {/* Right: Image */}
            <ScrollAnimation animation="slide-right" className="order-1 lg:order-2">
              <div className="relative group lg:top-3">
                <div className="absolute -inset-2 bg-gradient-to-br from-gold/20 to-crimson/20 rounded-3xl blur-xl opacity-70 group-hover:opacity-100 transition-opacity" />
                <button
                  type="button"
                  aria-label="放大查看课程主图"
                  onClick={() => setShowImagePreview(true)}
                  className="relative block w-full overflow-hidden rounded-2xl shadow-xl aspect-[4/3] bg-gradient-to-br from-gold/5 to-crimson/5 border-2 border-gold/10 text-left cursor-zoom-in"
                >
                  <PlaceholderImage
                    src={course.image}
                    alt={course.title}
                    className="transition-transform duration-500 group-hover:scale-105"
                    priority
                  />
                </button>
              </div>
            </ScrollAnimation>
          </div>
        </div>
      </section>

      {/* ========== Course Overview Section ========== */}
      <section className="py-12 md:py-16 bg-white border-b border-sand/20">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div>
            <div>
              <ScrollAnimation>
                <h2 className="font-serif text-2xl md:text-3xl font-bold text-text mb-6">课程期次</h2>
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
                <ScrollAnimation delay={220}>
                  <div className="rounded-2xl border border-sand/30 bg-warm-white/70 p-4 md:p-5">
                    <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                      <div>
                        <h3 className="font-serif text-xl font-bold text-text">开课期次</h3>
                        <p className="text-sm text-text-muted">同一课程的不同期次统一展示，报名时以实际开课通知为准</p>
                      </div>
                      <Link
                        href="/offline?tab=courses"
                        className="inline-flex items-center gap-1 text-sm font-medium text-gold-dark hover:text-crimson transition-colors"
                      >
                        查看课程日历 <ChevronRight className="h-4 w-4" />
                      </Link>
                    </div>

                    {recordsLoading ? (
                      <div className="rounded-xl bg-white px-4 py-6 text-center text-sm text-text-muted">
                        正在同步期次记录...
                      </div>
                    ) : matchedRecords.length > 0 ? (
                      <div className="overflow-x-auto rounded-xl border border-sand/30 bg-white">
                        <table className="w-full min-w-[940px] whitespace-nowrap text-left text-sm xl:min-w-0">
                          <thead className="bg-sand/20 text-xs text-text-muted">
                            <tr>
                              <th className="px-4 py-3 font-medium">课程期次</th>
                              <th className="px-4 py-3 font-medium">时间</th>
                              <th className="px-4 py-3 font-medium">地点</th>
                              <th className="px-4 py-3 font-medium">课次</th>
                              <th className="px-4 py-3 font-medium">老师</th>
                              <th className="px-4 py-3 font-medium">费用</th>
                              <th className="px-4 py-3 font-medium">名额</th>
                              <th className="px-4 py-3 font-medium">状态</th>
                              <th className="px-4 py-3 font-medium">课时</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-sand/20">
                            {matchedRecords.map((record, index) => {
                              const status = getCourseStatus(record);
                              return (
                                <tr key={`${record.id}-${record.startDate || index}`} className="align-top">
                                  <td className="px-4 py-3 font-medium text-text">
                                    {getSessionCourseName(record)}
                                  </td>
                                  <td className="px-4 py-3 text-text-secondary">{formatDateRange(record)}</td>
                                  <td className="px-4 py-3 text-text-secondary">{record.location || '长沙总部'}</td>
                                  <td className="px-4 py-3 text-text-secondary">{record.sessions ? `${record.sessions}课次` : '待定'}</td>
                                  <td className="px-4 py-3 text-text-secondary">{record.teacher || course.instructor}</td>
                                  <td className="px-4 py-3 font-semibold text-crimson">
                                    {record.price ? `¥${Number(record.price).toLocaleString('zh-CN')}` : '待定'}
                                  </td>
                                  <td className="px-4 py-3 text-text-secondary">
                                    {record.capacity
                                      ? (record.remaining ? `剩余 ${record.remaining}/${record.capacity}` : `${record.capacity} 人`)
                                      : '待定'}
                                  </td>
                                  <td className="px-4 py-3">
                                    {status === 'ended' ? (
                                      <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
                                        已结业
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => { window.location.href = `/checkout/offline/${record.id}`; }}
                                        className="inline-flex whitespace-nowrap rounded-full bg-crimson px-3 py-1 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-crimson-dark focus:outline-none focus:ring-2 focus:ring-crimson/30"
                                        aria-label={`报名${getSessionCourseName(record)}`}
                                      >
                                        点击报名
                                      </button>
                                    )}
                                  </td>
                                  <td className="px-4 py-3"><Link href={`/offline?tab=rights&course_ids=${record.id}`} className="whitespace-nowrap rounded-full bg-[#9F1D20] px-3 py-2 text-sm text-white">查看期次课时</Link></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="rounded-xl bg-white px-4 py-6 text-center text-sm text-text-muted">
                        暂无开班期次
                      </div>
                    )}
                  </div>
                </ScrollAnimation>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== Core Values Section ========== */}
      <section className="py-12 md:py-16 bg-warm-white border-b border-sand/20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollAnimation>
            <div className="text-center mb-10">
              <h2 className="font-serif text-2xl md:text-3xl font-bold text-text mb-3">为什么选择这门课程</h2>
              <p className="text-text-secondary">{course.title} 的课程优势</p>
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

      {/* ========== Course Outline (full expanded) ========== */}
      <section className="py-12 md:py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollAnimation>
            <div className="text-center mb-10">
              <h2 className="font-serif text-2xl md:text-3xl font-bold text-text mb-3">课程大纲</h2>
              <p className="text-text-secondary">系统化课程设计，循序渐进掌握核心技能</p>
            </div>
          </ScrollAnimation>

          <div className="space-y-3">
            {moduleItems.length > 0 ? (
              /* Module-style outline */
              moduleItems.map((item, i) => {
                const match = item.match(/^【(.+?)】(.+)/);
                const moduleTitle = match ? `【${match[1]}】` : '';
                const moduleDesc = match ? match[2].trim() : item;
                return (
                  <ScrollAnimation key={i} delay={i * 60}>
                    <div className="group bg-warm-gray/50 rounded-xl shadow-sm hover:shadow-md hover:border-gold/30 transition-all border border-sand/20 overflow-hidden">
                      <div className="p-4 md:p-5 flex items-start gap-4">
                        <div className="flex-shrink-0 w-9 h-9 bg-gradient-to-br from-gold to-gold-dark rounded-lg flex items-center justify-center shadow-sm">
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
                  <div className="flex items-start gap-4 p-4 bg-warm-gray/50 rounded-xl shadow-sm hover:shadow-md transition-all border border-sand/20">
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

          {/* Total count */}
          <ScrollAnimation delay={course.outline.length * 60}>
            <div className="mt-8 text-center">
              <div className="inline-flex items-center gap-2 bg-gold/5 border border-gold/20 rounded-full px-6 py-3">
                <Layers className="w-5 h-5 text-gold" />
                <span className="text-text font-medium">
                  共 <span className="text-gold-dark font-bold">{course.outline.length}</span> 个模块
                </span>
              </div>
            </div>
          </ScrollAnimation>
        </div>
      </section>

      {/* ========== Final CTA Section ========== */}
      <section className="py-16 md:py-20 bg-gradient-to-r from-crimson-dark to-gold-dark text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-64 h-64 bg-white rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl translate-x-1/3 translate-y-1/3" />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollAnimation>
            <h2 className="font-serif text-3xl md:text-4xl font-bold mb-4">
              开启你的东方舞进阶之旅
            </h2>
            <p className="text-lg text-white/80 mb-8 max-w-2xl mx-auto">
              名额有限，立即咨询咨询，锁定学习席位
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => setShowServiceModal(true)}
                className="px-10 py-4 bg-white text-crimson-dark font-bold rounded-xl hover:shadow-xl hover:shadow-white/20 transition-all text-base"
              >
                <Phone className="w-4 h-4 inline mr-2" />
                预约咨询
              </button>
              <Link
                href={graduationReportHref || '/contact'}
                className="px-10 py-4 border-2 border-white/40 text-white font-semibold rounded-xl hover:bg-white/10 transition-all text-base"
              >
                {graduationReportHref ? '学员结业汇报' : '了解更多'}
              </Link>
            </div>
          </ScrollAnimation>
        </div>
      </section>

      {/* Course Image Preview */}
      {showImagePreview && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <button
            type="button"
            aria-label="关闭课程主图预览"
            className="absolute inset-0 cursor-zoom-out"
            onClick={() => setShowImagePreview(false)}
          />
          <div className="relative z-10 flex max-h-[92vh] w-full max-w-6xl items-center justify-center">
            <button
              type="button"
              aria-label="关闭"
              onClick={() => setShowImagePreview(false)}
              className="absolute -right-2 -top-12 rounded-full bg-white/90 p-2 text-text shadow-lg transition hover:bg-white hover:text-crimson md:right-0"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={course.image}
              alt={`${course.title} 主图`}
              className="max-h-[92vh] w-full rounded-xl bg-white object-contain shadow-2xl"
            />
          </div>
        </div>
      )}

      {/* Service Modal */}
      {showServiceModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <button
            type="button"
            aria-label="关闭客服联系方式"
            className="absolute inset-0 cursor-default"
            onClick={() => setShowServiceModal(false)}
          />
          <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl md:p-6">
            <button
              type="button"
              aria-label="关闭"
              onClick={() => setShowServiceModal(false)}
              className="absolute right-4 top-4 rounded-full p-2 text-text-muted transition-colors hover:bg-gold/10 hover:text-crimson"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="mb-5 pr-10">
              <h3 className="flex items-center gap-2 font-serif text-xl font-bold text-text md:text-2xl">
                <Headphones className="h-5 w-5 text-gold" />
                联系客服老师预约咨询
              </h3>
              <p className="mt-2 text-sm leading-6 text-text-secondary">
                课程：{course.title}。扫码添加客服微信，或直接拨打电话咨询线下课程安排。
              </p>
            </div>

            <div className="mb-5 grid gap-2 md:grid-cols-2">
              {customerServicePhones.map((item) => (
                <a
                  key={item.phone}
                  href={`tel:${item.phone}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-gold/20 bg-gold/5 px-4 py-3 text-left transition-colors hover:border-gold/50 hover:bg-gold/10"
                >
                  <span>
                    <span className="block text-sm font-semibold text-text">{item.name}</span>
                    <span className="block text-xs text-text-muted">点击拨打</span>
                  </span>
                  <span className="flex items-center gap-2 text-sm font-bold text-crimson">
                    <PhoneCall className="h-4 w-4" />
                    {item.display}
                  </span>
                </a>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 md:gap-4">
              {customerServiceQRCodes.map((qr) => (
                <div key={qr.src} className="rounded-xl border border-sand/60 bg-warm-white p-3 text-center">
                  <div className="relative mx-auto aspect-[3/4] w-full overflow-hidden rounded-lg bg-white">
                    <Image
                      src={qr.src}
                      alt={`${qr.name}微信二维码`}
                      fill
                      sizes="(max-width: 768px) 44vw, 260px"
                      className="object-contain"
                    />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-text">{qr.name}</p>
                  <p className="text-xs text-text-muted">{qr.note}</p>
                </div>
              ))}
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
