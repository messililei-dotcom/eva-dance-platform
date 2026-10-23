import { getCoursePromotion, applyCoursePromotion } from '@/lib/server/course-promotion';
import { studentDisplayBases } from '@/lib/server/student-display';
import { courses as websiteCourses, type Course } from '@/config/courses';
import { jsonError, withDb } from './_db';
import { noStoreJson } from '@/lib/http-cache';
import { resolveStaticSeriesCover } from '@/lib/course-cover-assets';
import { alignCourseLessonCountText } from '@/lib/course-lesson-count';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ADMIN_ORIGIN = process.env.ADMIN_ORIGIN
  || process.env.NEXT_PUBLIC_ADMIN_ORIGIN
  || 'https://admin.swod.com.cn';
function publicAdminOrigin() {
  return /localhost|127\.|0\.0\.0\.0/i.test(ADMIN_ORIGIN) ? 'https://admin.swod.com.cn' : ADMIN_ORIGIN;
}

function normalizeCourseKey(value: string): string {
  return value
    .replace(/\([^)]*\)|（[^）]*）/g, '')
    .replace(/成品舞/g, '')
    .replace(/[^\u4e00-\u9fa5a-z0-9]/gi, '')
    .toLowerCase();
}

function normalizeImage(value?: string) {
  const image = String(value || '').trim();
  if (!image) return '/images/courses/placeholder-course.svg';
  if (/^https?:\/\//i.test(image)) return image;
  if (image.startsWith('/api/course/series/cover/')) return image;
  if (image.startsWith('/api/course/') || image.startsWith('/uploads/')) return `${publicAdminOrigin()}${image}`;
  return image;
}

function resolveCourseImage(platformImage?: string, fallbackImage?: string) {
  return normalizeImage(resolveStaticSeriesCover(platformImage) || fallbackImage);
}

function staticMatch(name: string) {
  const key = normalizeCourseKey(name);
  if (!key) return undefined;
  return websiteCourses.find((course) => {
    if (course.category === 'offline') return false;
    const courseKey = normalizeCourseKey(course.title);
    return courseKey === key || courseKey.includes(key) || key.includes(courseKey);
  });
}

function seriesToCourse(row: any): Course & { platformSeriesId: number; platformCategory?: string; legacyCourseId?: string } {
  const matched = staticMatch(row.name);
  const isDanceCollection = String(row.category || '').includes('成品舞');
  const totalCourses = Number(row.total_courses || 0);

  return {
    ...(matched || {}),
    id: String(row.id),
    title: row.name || matched?.title || '未命名课程',
    description: row.subtitle || row.description || matched?.description || '',
    fullDescription: alignCourseLessonCountText(row.description || matched?.fullDescription || row.subtitle || '', totalCourses),
    price: Number(row.is_free) === 1 ? 0 : Number(row.promo_price || row.price || 0),
    originalPrice: Number(row.is_free) === 1 || !(Number(row.promo_price) > 0) || Number(row.price) <= Number(row.promo_price) ? undefined : Number(row.price),
    image: resolveCourseImage(row.cover_image, matched?.image),
    category: isDanceCollection ? 'dance-collection' : 'online',
    type: matched?.type || 'recorded',
    instructor: row.teacher || matched?.instructor || '伊娃',
    duration: totalCourses ? `${totalCourses} 节系统课程` : matched?.duration || '课程持续更新',
    level: matched?.level || '全级别',
    outline: matched?.outline?.length ? matched.outline : ['课程目录待发布'],
    isNew: matched?.isNew || Number(row.sort_order || 0) >= 10,
    isHot: matched?.isHot || Number(row.total_students || 0) > 0,
    platformSeriesId: Number(row.id),
    totalStudents: Number(row.total_students || 0),
    displayStudents: Number(row.total_students || 0) + Number(row.student_display_base || 0),
    platformCategory: row.category || '',
    legacyCourseId: matched?.id || '',
  };
}

export async function GET() {
  try {
    return withDb((db) => {
      const displayBases = studentDisplayBases(db);
      const promotionEnabled = getCoursePromotion(db).enabled;
      const rows = db.prepare(
        `SELECT cs.id, cs.name, cs.subtitle, cs.category, cs.teacher, cs.price, cs.promo_price, cs.is_free, cs.cover_image,
                cs.status, cs.description, cs.sort_order, cs.created_at,
                (SELECT COUNT(*) FROM OnlineCourse WHERE series_id=cs.id AND status='published') as total_courses,
                (SELECT COUNT(DISTINCT member_id) FROM CourseAuthorization WHERE series_id=cs.id) as total_students
         FROM CourseSeries cs
         WHERE cs.status='published'
         ORDER BY cs.sort_order, cs.id`,
      ).all();

      const stats = db.prepare(
        `SELECT
           COUNT(*) as total_series,
           SUM(CASE WHEN cs.category='线上系统课' THEN 1 ELSE 0 END) as online_series,
           SUM(CASE WHEN cs.category='成品舞' THEN 1 ELSE 0 END) as dance_series,
           (SELECT COUNT(*) FROM OnlineCourse oc
              INNER JOIN CourseSeries published ON published.id=oc.series_id
              WHERE published.status='published' AND oc.status='published') as total_lessons,
           (SELECT COUNT(DISTINCT ca.member_id) FROM CourseAuthorization ca
              INNER JOIN CourseSeries published ON published.id=ca.series_id
              WHERE published.status='published') as total_students
         FROM CourseSeries cs
         WHERE cs.status='published'`,
      ).get();

      return noStoreJson({
        success: true,
        data: rows.map((row: any) => seriesToCourse({ ...applyCoursePromotion(row, promotionEnabled), student_display_base: displayBases.get(Number(row.id)) })),
        stats,
      });
    });
  } catch (err: any) {
    return jsonError(err?.message || '获取平台课程失败');
  }
}
