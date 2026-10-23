import { danceCircleArticles, type DanceCircleArticle } from '@/data/dance-circle';
import { getEventsNews, getEventStatus } from '@/lib/events-news';
import type { EventNews } from '@/types/events-news';

function reportToArticle(report: EventNews): DanceCircleArticle {
  const isCourse = report.reportType === 'course';
  return {
    slug: report.slug,
    title: report.title,
    summary: report.summary,
    category: isCourse ? '课程纪实' : '赛事报道',
    date: report.date,
    location: report.location,
    image: report.coverImage ? `/api/events-news/media/${report.slug}` : '/images/placeholder-hero.svg',
    sourceNote: '伊娃东方舞数字化平台',
    contentHtml: report.content,
    relatedHref: isCourse ? report.relatedCourse?.href : `/events/${report.slug}`,
    relatedLabel: isCourse ? (report.relatedCourse?.label || '查看相关课程') : '查看完整赛事与成绩',
    sections: [],
  };
}

export function getDanceCircleArticles(): DanceCircleArticle[] {
  const articles = new Map(danceCircleArticles.map((article) => [article.slug, article]));

  for (const report of getEventsNews()) {
    const isCourse = report.reportType === 'course';
    if (!isCourse && getEventStatus(report) !== 'ended') continue;
    if (!articles.has(report.slug)) articles.set(report.slug, reportToArticle(report));
  }

  return [...articles.values()].sort((a, b) =>
    b.date.localeCompare(a.date) || a.title.localeCompare(b.title, 'zh-CN'),
  );
}

export function getDanceCircleArticle(slug: string): DanceCircleArticle | undefined {
  return getDanceCircleArticles().find((article) => article.slug === slug);
}
