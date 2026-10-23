import type { Metadata } from 'next';
import fs from 'fs';
import path from 'path';
import { courses, type Course } from '@/config/courses';
import { toPositiveInt, withDb } from '@/app/api/platform-courses/_db';
import { findBestCourseMatch, getPublicCourseName, type PublicCourseRecord } from '@/lib/course-match';
import { resolveStaticSeriesCover } from '@/lib/course-cover-assets';

export const SITE_ORIGIN = 'https://www.swod.com.cn';
export const SITE_NAME = '伊娃东方舞';
export const DEFAULT_SHARE_IMAGE = '/icons/icon-512-20261005.png';
const DEFAULT_ADMIN_UPLOADS_ROOT = '/www/wwwroot/dongfangwuquan/admin-platform/public/uploads';
const ADMIN_UPLOADS_ROOT = process.env.ADMIN_UPLOADS_ROOT || DEFAULT_ADMIN_UPLOADS_ROOT;
const TRAINING_COVERS_ROOT = path.join(ADMIN_UPLOADS_ROOT, 'training-courses');

type ShareInput = {
  title: string;
  shareTitle?: string;
  description?: string;
  path?: string;
  image?: string;
  type?: 'website' | 'article';
  publishedTime?: string;
};

export type ShareCourse = Pick<Course, 'id' | 'title' | 'description' | 'image' | 'category'> & {
  legacyCourseId?: string;
  platformSeriesId?: number;
  platformCourseId?: number;
};

function cleanText(value?: string, fallback = '') {
  return String(value || fallback)
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

export function absoluteUrl(value?: string) {
  const url = String(value || DEFAULT_SHARE_IMAGE).trim();
  if (/^https?:\/\//i.test(url)) return url;
  return `${SITE_ORIGIN}${url.startsWith('/') ? url : `/${url}`}`;
}

export function buildShareMetadata(input: ShareInput): Metadata {
  const title = cleanText(input.title, '伊娃东方舞');
  const shareTitle = cleanText(input.shareTitle || title, title).slice(0, 48);
  const description = cleanText(
    input.description,
    '伊娃东方舞，专注东方舞系统课程、线下培训、师资认证与传承弟子培养。',
  );
  const url = absoluteUrl(input.path || '/');
  const image = absoluteUrl(input.image || DEFAULT_SHARE_IMAGE);
  const imageMetadata = input.image
    ? { url: image, alt: title }
    : { url: image, width: 512, height: 512, alt: title };
  const openGraph: Metadata['openGraph'] = input.type === 'article'
    ? {
        title: shareTitle,
        description,
        url,
        siteName: SITE_NAME,
        type: 'article',
        publishedTime: input.publishedTime,
        authors: [SITE_NAME],
        images: [imageMetadata],
        locale: 'zh_CN',
      }
    : {
        title: shareTitle,
        description,
        url,
        siteName: SITE_NAME,
        type: 'website',
        images: [imageMetadata],
        locale: 'zh_CN',
      };

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph,
    twitter: {
      card: input.type === 'article' ? 'summary_large_image' : 'summary',
      title: shareTitle,
      description,
      images: [image],
    },
    other: {
      'weixin:title': shareTitle,
      'weixin:description': description,
      'weixin:image': image,
    },
  };
}

function isImage(filename: string) {
  return /\.(jpe?g|png|webp|gif|bmp|svg)$/i.test(filename);
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

function trainingCoverExists(value?: string) {
  const image = String(value || '').trim();
  const proxied = trainingCourseCoverProxy(image);
  if (!proxied) return true;
  if (!fs.existsSync(TRAINING_COVERS_ROOT)) return false;

  const filename = path.basename(decodeURIComponent(proxied.split('/').pop() || ''));
  if (!filename || !isImage(filename)) return false;

  const root = path.resolve(TRAINING_COVERS_ROOT);
  const absolutePath = path.resolve(root, filename);
  return absolutePath.startsWith(root + path.sep)
    && fs.existsSync(absolutePath)
    && fs.statSync(absolutePath).isFile();
}

function normalizeImage(value?: string) {
  const image = String(value || '').trim();
  if (!image) return DEFAULT_SHARE_IMAGE;
  if (/^https?:\/\//i.test(image)) return image;
  if (image.startsWith('/api/course/') || image.startsWith('/api/platform-offline-courses/') || image.startsWith('/uploads/')) {
    return `${SITE_ORIGIN}${image}`;
  }
  return image;
}

function resolveShareImage(platformImage?: string, fallbackImage?: string) {
  return normalizeImage(resolveStaticSeriesCover(platformImage) || fallbackImage);
}

function resolveOfflineShareImage(platformImage?: string, fallbackImage?: string) {
  const image = String(platformImage || '').trim();
  const proxied = image ? trainingCourseCoverProxy(image) : '';
  if (proxied && trainingCoverExists(image)) return normalizeImage(proxied);
  return normalizeImage(trainingCoverExists(image) ? image : fallbackImage);
}

function normalizeCourseKey(value: string): string {
  return value
    .replace(/\([^)]*\)|（[^）]*）/g, '')
    .replace(/成品舞/g, '')
    .replace(/[^\u4e00-\u9fa5a-z0-9]/gi, '')
    .toLowerCase();
}

function findStaticCourseByName(name: string) {
  const key = normalizeCourseKey(name);
  if (!key) return undefined;
  return courses.find((course) => {
    const courseKey = normalizeCourseKey(course.title);
    return courseKey === key || courseKey.includes(key) || key.includes(courseKey);
  });
}

export function findShareCourse(routeId: string): ShareCourse | undefined {
  try {
    const platformId = toPositiveInt(routeId);
    if (platformId) {
      const platformCourse = withDb((db) => {
        const row = db.prepare(
          `SELECT id, name, subtitle, description, cover_image, category
           FROM CourseSeries
           WHERE id=? AND status='published'`,
        ).get<any>(platformId);
        if (!row) return undefined;
        const matched = findStaticCourseByName(row.name || '');
        return {
          id: String(row.id),
          title: row.name || matched?.title || '线上课程',
          description: row.subtitle || row.description || matched?.description || '',
          image: resolveShareImage(row.cover_image, matched?.image),
          category: String(row.category || '').includes('成品舞') ? 'dance-collection' : 'online',
          legacyCourseId: matched?.id,
          platformSeriesId: Number(row.id),
        } as ShareCourse;
      });
      if (platformCourse) return platformCourse;
    }
  } catch {
    // Metadata should never block page rendering; fall back to local course config.
  }

  return courses.find(course => course.id === routeId);
}

export function findOfflineShareCourse(routeId: string): ShareCourse | undefined {
  const staticCourse = courses.find(item => item.id === routeId && item.category === 'offline');

  try {
    const platformId = toPositiveInt(routeId);
    if (platformId) {
      const platformCourse = withDb((db) => {
        const row = db.prepare(
          `SELECT id, name, subtitle, description, content,
                  coverImage, cover_image, image,
                  type, subType, teacher, instructor
           FROM Course
           WHERE id=? AND COALESCE(status, 'active') <> 'deleted'`,
        ).get<any>(platformId);
        if (!row) return undefined;

        const record: PublicCourseRecord = {
          id: row.id,
          name: row.name,
          type: row.type,
          subType: row.subType,
          teacher: row.teacher || row.instructor,
          content: row.content || row.description,
        };
        const title = getPublicCourseName(record);
        const matched = findBestCourseMatch(title, courses) || staticCourse;
        const platformImage = row.coverImage
          || row.cover_image
          || row.image;

        return {
          id: String(row.id),
          title: title || matched?.title || row.name || '线下培训课程',
          description: row.subtitle || row.description || row.content || matched?.description || '伊娃东方舞线下培训课程详情。',
          image: resolveOfflineShareImage(platformImage, matched?.image || staticCourse?.image),
          category: 'offline',
          legacyCourseId: matched?.id,
          platformCourseId: Number(row.id),
        } as ShareCourse;
      });
      if (platformCourse) return platformCourse;
    }
  } catch {
    // Metadata should never block page rendering; fall back to local course config.
  }

  return staticCourse;
}

export function courseShareDescription(course?: ShareCourse, fallback?: string) {
  if (!course) return fallback || '伊娃东方舞线上学院课程学习。';
  return course.description || fallback || `${course.title} · 伊娃东方舞线上学院`;
}
