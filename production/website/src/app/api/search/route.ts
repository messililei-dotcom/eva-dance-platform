import { courses } from '@/config/courses';
import { navItems } from '@/config/navigation';
import { disciples } from '@/data/disciples';
import { getDanceCircleArticles } from '@/lib/dance-circle';
import { getEventsNews } from '@/lib/events-news';
import { PAGE_CATALOG } from '@/lib/page-catalog';
import {
  normalizeSearchQuery,
  rankSearchResults,
  type SiteSearchCandidate,
} from '@/lib/site-search';
import { openAdminDb } from '@/lib/server/admin-db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const RESULT_LIMIT = 50;
const DATABASE_CANDIDATE_LIMIT = 160;

function stripHtml(value: string) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function staticCandidates(): SiteSearchCandidate[] {
  const pages = [
    ...Object.entries(PAGE_CATALOG).map(([id, page]) => ({
      id: `page-${id}`,
      kind: 'page' as const,
      title: page.title,
      description: page.description,
      href: page.path,
      keywords: page.shareTitle,
    })),
    ...navItems.flatMap((item) => [item, ...(item.children || [])]).map((item, index) => ({
      id: `nav-${index}-${item.href}`,
      kind: 'page' as const,
      title: item.label,
      description: `伊娃东方舞官网${item.label}栏目`,
      href: item.href,
    })),
  ];

  const websiteCourses: SiteSearchCandidate[] = courses.map((course) => ({
    id: `website-course-${course.id}`,
    kind: course.category === 'offline' ? 'offline-course' : 'online-course',
    title: course.title,
    description: course.description || course.fullDescription,
    href: course.category === 'offline' ? `/offline/${course.id}` : `/courses/${course.id}`,
    keywords: [
      course.instructor,
      course.type,
      course.level,
      course.duration,
      ...course.outline,
    ].join(' '),
  }));

  const news: SiteSearchCandidate[] = getDanceCircleArticles().map((article) => ({
    id: `news-${article.slug}`,
    kind: 'news',
    title: article.title,
    description: article.summary,
    href: article.canonicalPath || `/dance-circle/${article.slug}`,
    keywords: [
      article.category,
      article.location,
      article.sourceNote,
      ...article.sections.flatMap((section) => [section.heading, ...section.paragraphs]),
      stripHtml(article.contentHtml || ''),
    ].join(' '),
    date: article.date,
  }));

  const events: SiteSearchCandidate[] = getEventsNews().map((event) => ({
    id: `event-${event.slug}`,
    kind: 'event',
    title: event.title,
    description: event.summary,
    href: `/events/${event.slug}`,
    keywords: `${event.categoryLabel || ''} ${event.location} ${event.dateRange} ${stripHtml(event.content)}`,
    date: event.date,
  }));

  const teachers: SiteSearchCandidate[] = disciples.map((disciple) => ({
    id: `teacher-${disciple.id}`,
    kind: 'teacher',
    title: disciple.displayName || disciple.name,
    description: disciple.bio,
    href: `/disciples#disciple-${disciple.id}`,
    keywords: `${disciple.name} ${disciple.title} ${disciple.province} ${disciple.city} ${disciple.tags.join(' ')}`,
  }));

  return [...pages, ...websiteCourses, ...news, ...events, ...teachers];
}

function databaseCandidates(query: string): SiteSearchCandidate[] {
  const pattern = `%${query}%`;
  const db = openAdminDb({ readonly: true, fileMustExist: true });
  try {
    const series = db.prepare(`
      SELECT id, name, subtitle, description, teacher, category
      FROM CourseSeries
      WHERE status='published'
        AND (name LIKE ? OR subtitle LIKE ? OR description LIKE ? OR teacher LIKE ? OR category LIKE ?)
      ORDER BY sort_order, id
      LIMIT ?
    `).all<any>(pattern, pattern, pattern, pattern, pattern, DATABASE_CANDIDATE_LIMIT);

    const lessons = db.prepare(`
      SELECT
        oc.id,
        oc.series_id,
        oc.name,
        oc.description,
        oc.group_name,
        cs.name AS series_name,
        (
          SELECT cv.id
          FROM CourseVideo cv
          WHERE cv.course_id=oc.id AND cv.status='published'
          ORDER BY cv.sort_order, cv.id
          LIMIT 1
        ) AS video_id
      FROM OnlineCourse oc
      INNER JOIN CourseSeries cs ON cs.id=oc.series_id AND cs.status='published'
      WHERE oc.status='published'
        AND (oc.name LIKE ? OR oc.description LIKE ? OR oc.group_name LIKE ? OR cs.name LIKE ?)
      ORDER BY oc.sort_order, oc.id
      LIMIT ?
    `).all<any>(pattern, pattern, pattern, pattern, DATABASE_CANDIDATE_LIMIT);

    const videos = db.prepare(`
      SELECT
        cv.id,
        cv.name,
        oc.id AS course_id,
        oc.name AS course_name,
        oc.series_id,
        cs.name AS series_name
      FROM CourseVideo cv
      INNER JOIN OnlineCourse oc ON oc.id=cv.course_id AND oc.status='published'
      INNER JOIN CourseSeries cs ON cs.id=oc.series_id AND cs.status='published'
      WHERE cv.status='published' AND cv.name LIKE ?
      ORDER BY cv.sort_order, cv.id
      LIMIT ?
    `).all<any>(pattern, DATABASE_CANDIDATE_LIMIT);

    return [
      ...series.map((row) => ({
        id: `platform-course-${row.id}`,
        kind: String(row.category || '').includes('线下') ? 'offline-course' as const : 'online-course' as const,
        title: String(row.name || '未命名课程'),
        description: String(row.subtitle || row.description || `${row.category || '线上'}课程`),
        href: `/courses/${row.id}?source=platform`,
        keywords: `${row.teacher || ''} ${row.category || ''} ${row.description || ''}`,
      })),
      ...lessons.map((row) => ({
        id: `lesson-${row.id}`,
        kind: 'lesson' as const,
        title: String(row.name || '未命名课节'),
        description: `${row.series_name || '线上课程'}${row.group_name ? ` · ${row.group_name}` : ''}${row.description ? `｜${row.description}` : ''}`,
        href: `/courses/${row.series_id}/videos?source=platform${row.video_id ? `&video=${row.video_id}` : ''}`,
        keywords: `${row.series_name || ''} ${row.group_name || ''} ${row.description || ''}`,
      })),
      ...videos.map((row) => ({
        id: `video-${row.id}`,
        kind: 'lesson' as const,
        title: stripHtml(String(row.name || '')).replace(/\.(mp4|mov|m4v|webm)$/i, '') || String(row.course_name || '未命名课节'),
        description: `${row.series_name || '线上课程'} · ${row.course_name || '课程视频'}`,
        href: `/courses/${row.series_id}/videos?source=platform&video=${row.id}`,
        keywords: `${row.series_name || ''} ${row.course_name || ''}`,
      })),
    ];
  } finally {
    db.close();
  }
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const query = normalizeSearchQuery(searchParams.get('q'));
  if (!query) return Response.json({ query: '', results: [], total: 0 });

  let candidates = staticCandidates();
  let partial = false;
  try {
    candidates = [...candidates, ...databaseCandidates(query)];
  } catch (error) {
    partial = true;
    console.warn('数字化平台课程搜索暂不可用，已返回官网静态内容。', error);
  }

  const rankedResults = rankSearchResults(candidates, query, RESULT_LIMIT);
  const results = searchParams.get('v') === '2'
    ? rankedResults
    : rankedResults.map((result) => ({
      ...result,
      kind: result.kind === 'lesson'
        ? 'online-course' as const
        : result.kind === 'news'
          ? 'event' as const
          : result.kind,
    }));
  return Response.json(
    { query, results, total: results.length, partial },
    { headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=120' } },
  );
}
