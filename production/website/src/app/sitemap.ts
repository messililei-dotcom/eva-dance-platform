import type { MetadataRoute } from 'next';
import { courses } from '@/config/courses';
import { danceCircleArticles } from '@/data/dance-circle';

const SITE_ORIGIN = 'https://www.swod.com.cn';

const STATIC_PATHS = [
  '/',
  '/courses',
  '/offline',
  '/offline/schedule',
  '/certification',
  '/disciples',
  '/dance-circle',
  '/install',
  '/festival',
  '/festival/2023-changsha',
  '/about',
  '/about/brand-story',
  '/about/partners',
  '/about/publications',
  '/about/students',
  '/contact',
  '/shop',
  '/legal',
  '/privacy',
  '/terms',
];

function page(path: string, priority = 0.7): MetadataRoute.Sitemap[number] {
  return {
    url: `${SITE_ORIGIN}${path}`,
    lastModified: new Date(),
    changeFrequency: path === '/' ? 'daily' : 'weekly',
    priority,
  };
}

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = STATIC_PATHS.map((path) => page(path, path === '/' ? 1 : 0.8));
  const coursePages = courses
    .filter((course) => course.id && course.category !== 'offline')
    .map((course) => page(`/courses/${course.id}`, 0.7));
  const offlinePages = courses
    .filter((course) => course.id && course.category === 'offline')
    .map((course) => page(`/offline/${course.id}`, 0.7));
  const danceCirclePages = danceCircleArticles.map((article) => ({
    ...page(article.canonicalPath || `/dance-circle/${article.slug}`, 0.75),
    lastModified: new Date(`${article.date}T00:00:00+08:00`),
  }));

  return [...staticPages, ...coursePages, ...offlinePages, ...danceCirclePages];
}
