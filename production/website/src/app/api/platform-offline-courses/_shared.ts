import { type Course, courses as websiteCourses } from '@/config/courses';
import {
  findBestCourseMatch,
  getPublicCourseName,
  normalizeCourseKey,
  type PublicCourseRecord,
} from '@/lib/course-match';
import { withDb } from '../platform-courses/_db';

const ADMIN_ORIGIN = process.env.ADMIN_ORIGIN
  || process.env.NEXT_PUBLIC_ADMIN_ORIGIN
  || 'https://admin.swod.com.cn';

function publicAdminOrigin() {
  return /localhost|127\.|0\.0\.0\.0/i.test(ADMIN_ORIGIN) ? 'https://admin.swod.com.cn' : ADMIN_ORIGIN;
}

function trainingCourseCoverProxy(image: string) {
  const pathPart = (() => {
    try {
      return new URL(image).pathname;
    } catch {
      return image;
    }
  })();

  const marker = '/uploads/training-courses/';
  const index = pathPart.indexOf(marker);
  if (index < 0) return '';

  const filename = pathPart.slice(index + marker.length).split('/').pop() || '';
  return filename ? `/api/platform-offline-courses/cover/${encodeURIComponent(decodeURIComponent(filename))}` : '';
}

function normalizeImage(row: any, fallback = '') {
  const image = String(
    row.coverImage
    || row.cover_image
    || row.cover
    || row.poster
    || row.posterImage
    || row.poster_image
    || row.imageUrl
    || row.image_url
    || row.image
    || '',
  ).trim();
  if (!image) return fallback || '/images/courses/placeholder-course.svg';
  const proxiedTrainingCover = trainingCourseCoverProxy(image);
  if (proxiedTrainingCover) return proxiedTrainingCover;
  if (/^https?:\/\//i.test(image)) return image;
  if (image.startsWith('/uploads/') || image.startsWith('/api/')) return `${publicAdminOrigin()}${image}`;
  return image;
}

function parseOutline(value: unknown, fallback: string[]) {
  const text = String(value || '').trim();
  if (!text) return fallback;
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
  } catch {
    // Plain text outlines are common in old records.
  }
  return text.split(/\n|,|，/).map((item) => item.trim()).filter(Boolean);
}

function formatPlatformDateRange(row: any) {
  if (row.dateRange) return row.dateRange;
  const startDate = String(row.startDate || '').trim();
  const endDate = String(row.endDate || '').trim();
  if (startDate && endDate && endDate >= startDate) return `${startDate} 至 ${endDate}`;
  if (startDate) return `${startDate} 起`;
  return '';
}

function toPlatformOfflineCourse(row: any): Course & {
  platformCourseId: number;
  legacyCourseId?: string;
  platformStatus?: string;
  remaining?: number;
  capacity?: number;
  startDate?: string;
  endDate?: string;
  location?: string;
  subType?: string;
  sessionName?: string;
  scheduleLabel?: string;
  officialMatchKey?: string;
} {
  const record: PublicCourseRecord = {
    id: row.id,
    name: row.name,
    type: row.type,
    subType: row.subType,
    scheduleLabel: row.dateRange || row.validDays,
    startDate: row.startDate,
    endDate: row.endDate,
    price: Number(row.price) || 0,
    sessions: Number(row.sessions) || 0,
    teacher: row.teacher || row.instructor,
    content: row.content || row.description,
  };
  const matched = findBestCourseMatch(getPublicCourseName(record), websiteCourses);
  const sessions = Number(row.sessions || row.duration || 0);
  const dateRange = formatPlatformDateRange(row);
  const sessionName = String(row.subType || row.dateRange || row.validDays || '').trim();

  return {
    ...(matched || {}),
    id: String(row.id),
    title: row.name || matched?.title || '线下培训课程',
    description: row.subtitle || row.description || row.content || matched?.description || row.type || '',
    fullDescription: row.fullDescription || row.description || row.content || matched?.fullDescription || '',
    price: Number(row.price || matched?.price || 0),
    originalPrice: matched?.originalPrice,
    // Prefer the cover maintained by the digital platform. Older periods may
    // not have one, so retain the matched official-site cover as a fallback.
    image: normalizeImage(row, matched?.image),
    category: 'offline',
    type: row.type || matched?.type || '线下培训',
    instructor: row.teacher || row.instructor || matched?.instructor || '伊娃',
    duration: sessions ? `${sessions} 天/节` : matched?.duration || '以平台排期为准',
    level: row.level || row.subType || matched?.level || '全级别',
    outline: parseOutline(row.outline || row.highlights, matched?.outline || ['课程内容待发布']),
    dateRange,
    isNew: Boolean(row.isNew) || matched?.isNew,
    isHot: Boolean(row.isHot) || matched?.isHot,
    platformCourseId: Number(row.id),
    legacyCourseId: matched?.id || '',
    platformStatus: row.status || '',
    remaining: Number(row.remaining || 0),
    capacity: Number(row.capacity || 0),
    startDate: row.startDate || '',
    endDate: row.endDate || '',
    location: row.location || '长沙总部',
    subType: row.subType || '',
    sessionName,
    scheduleLabel: sessionName,
    // Period aggregation must be stricter than the fuzzy match used to borrow
    // website presentation copy; otherwise similarly named bootcamps can mix.
    officialMatchKey: normalizeCourseKey(row.name || ''),
  };
}

export function getPlatformOfflineCourses() {
  return withDb((db) => {
    const rows = db.prepare(`
        SELECT course.*
        FROM Course course
        LEFT JOIN CourseTemplate template ON template.id = course.templateId
        WHERE COALESCE(course.name, '') <> ''
          AND COALESCE(course.status, 'active') <> 'deleted'
          AND COALESCE(course.category, '') NOT LIKE '%演示%'
          AND COALESCE(course.name, '') NOT LIKE '%测试%'
          AND COALESCE(template.websiteVisible, 1) = 1
        ORDER BY
          CASE WHEN COALESCE(NULLIF(course.startDate, ''), '') = '' THEN 1 ELSE 0 END,
          COALESCE(NULLIF(course.startDate, ''), course.created_at) DESC,
          course.id DESC
    `).all();

    return rows.map(toPlatformOfflineCourse);
  });
}
