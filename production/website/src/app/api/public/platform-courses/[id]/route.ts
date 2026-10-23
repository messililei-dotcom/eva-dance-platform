import { courses as websiteCourses, type Course } from '@/config/courses';
import { jsonError, toPositiveInt, withDb } from '../../../mini/_helpers';
import { alignCourseLessonCountText } from '@/lib/course-lesson-count';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ADMIN_ORIGIN = process.env.ADMIN_ORIGIN
  || process.env.NEXT_PUBLIC_ADMIN_ORIGIN
  || 'https://admin.swod.com.cn';

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
  if (image.startsWith('/api/course/') || image.startsWith('/uploads/')) return `${ADMIN_ORIGIN}${image}`;
  return image;
}

function findStaticMatchByName(name: string) {
  const key = normalizeCourseKey(name);
  if (!key) return undefined;
  return websiteCourses.find((course) => {
    if (course.category === 'offline') return false;
    const courseKey = normalizeCourseKey(course.title);
    return courseKey === key || courseKey.includes(key) || key.includes(courseKey);
  });
}

function findSeries(db: any, routeId: string) {
  const exactId = toPositiveInt(routeId);
  if (exactId) {
    const exact = db.prepare('SELECT * FROM CourseSeries WHERE id=? AND status=?').get(exactId, 'published');
    if (exact) return exact;
  }

  const websiteCourse = websiteCourses.find(course => course.id === routeId);
  const targetKey = normalizeCourseKey(websiteCourse?.title || '');
  if (!targetKey) return null;
  const rows = db.prepare('SELECT * FROM CourseSeries WHERE status=?').all('published');
  return rows.find((row: any) => {
    const key = normalizeCourseKey(row.name || '');
    return key && (key === targetKey || key.includes(targetKey) || targetKey.includes(key));
  }) || null;
}

function seriesToCourse(row: any): Course & { platformSeriesId: number; platformCategory?: string; legacyCourseId?: string } {
  const matched = findStaticMatchByName(row.name);
  const isDanceCollection = String(row.category || '').includes('成品舞')
    || !String(row.category || '').includes('线上学院');
  const totalCourses = Number(row.total_courses || row.course_count || 0);

  return {
    ...(matched || {}),
    id: String(row.id),
    title: row.name || matched?.title || '未命名课程',
    description: row.subtitle || row.description || matched?.description || '',
    fullDescription: alignCourseLessonCountText(row.description || row.rich_description || matched?.fullDescription || row.subtitle || '', totalCourses),
    price: Number(row.promo_price || row.price || matched?.price || 0),
    originalPrice: Number(row.price || matched?.originalPrice || row.promo_price || 0) || undefined,
    image: normalizeImage(row.cover_image || matched?.image),
    category: isDanceCollection ? 'dance-collection' : 'online',
    type: matched?.type || 'recorded',
    instructor: row.teacher || matched?.instructor || '伊娃',
    duration: totalCourses ? `${totalCourses} 节系统课程` : matched?.duration || '课程持续更新',
    level: matched?.level || '全级别',
    outline: matched?.outline?.length ? matched.outline : ['课程目录待发布'],
    isNew: matched?.isNew || Number(row.sort_order || 0) >= 10,
    isHot: matched?.isHot || Number(row.total_students || 0) > 0,
    platformSeriesId: Number(row.id),
    platformCategory: row.category || '',
    legacyCourseId: matched?.id || '',
  };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const routeParams = await params;
    return withDb((db) => {
      const series = findSeries(db, routeParams.id);
      if (!series) return jsonError('课程不存在', 404);
      const total = db.prepare("SELECT COUNT(*) as count FROM OnlineCourse WHERE series_id=? AND status='published'").get<{ count: number }>(series.id);
      const students = db.prepare('SELECT COUNT(DISTINCT member_id) as count FROM CourseAuthorization WHERE series_id=?').get<{ count: number }>(series.id);
      return Response.json({
        success: true,
        data: seriesToCourse({
          ...series,
          total_courses: total?.count || 0,
          total_students: students?.count || 0,
        }),
      });
    });
  } catch (err: any) {
    return jsonError(err?.message || '获取平台课程详情失败');
  }
}
