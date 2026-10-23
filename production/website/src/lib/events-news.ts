import fs from 'fs';
import { cache } from 'react';
import path from 'path';
import type { EventNews } from '@/types/events-news';
import { openAdminDb } from '@/lib/server/admin-db';

const DATA_PATH = path.join(process.cwd(), 'public/data/events-news.json');
let cachedEvents: EventNews[] | null = null;
let archiveVersion = '';
let archiveEvents: EventNews[] = [];
function getArchivedEvents(): EventNews[] {
  const stat = fs.statSync(DATA_PATH);
  const version = `${stat.mtimeMs}:${stat.size}`;
  if (version !== archiveVersion) {
    archiveEvents = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8')) as EventNews[];
    archiveVersion = version;
  }
  return archiveEvents;
}

// Confirmed inspection fixture: retain the record in admin, exclude all public views.
const INTERNAL_EVENT_IDS = new Set<number>();
export function isPublicEvent(item: EventNews) {
  const id = getEventCompetitionId(item);
  return id === null || !INTERNAL_EVENT_IDS.has(id);
}

type PlatformEventRow = {
  id: number;
  name: string;
  registration_status: string;
  registration_public: number;
  start_date: string;
  end_date: string;
  location: string;
  description: string;
  cover_url: string;
  group_count: number;
  player_count: number;
  score_count: number;
  judge_count: number;
};

function dateOnly(value: string): string {
  return String(value || '').slice(0, 10);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function platformCoverUrl(value: string): string | null {
  if (!value) return null;
  if (/^https:\/\//i.test(value)) return value;
  return `https://admin.swod.com.cn/${value.replace(/^\/+/, '')}`;
}

function platformEventToNews(row: PlatformEventRow): EventNews {
  const startDate = dateOnly(row.start_date);
  const endDate = dateOnly(row.end_date) || startDate;
  const year = startDate.slice(0, 4) || 'event';
  const slug = `event-${year}-${row.id}`;
  const dateRange = startDate && endDate && startDate !== endDate
    ? `${startDate} 至 ${endDate}`
    : startDate || '时间待定';
  const location = row.location || '赛事现场';
  const summary = `${row.name}，${dateRange}，${location}。赛事设置${Number(row.group_count || 0)}个组别，${Number(row.registration_public) === 1 ? `${Number(row.player_count || 0)}位选手，` : "报名信息暂未公开，"}${Number(row.judge_count || 0)}位评委。`;

  return {
    id: slug,
    slug,
    title: row.name,
    date: startDate || `${year}-01-01`,
    dateRange,
    location,
    categoryLabel: '东方舞赛事',
    reportType: 'event',
    registrationPublic: Number(row.registration_public) === 1,
    registrationStatus: row.registration_status === 'open' ? 'open' : 'closed',
    coverImage: platformCoverUrl(row.cover_url),
    summary,
    content: `<h2>赛事介绍</h2><p>${escapeHtml(summary)}</p>`,
    stats: {
      groups: Number(row.group_count || 0),
      players: Number(row.registration_public) === 1 ? Number(row.player_count || 0) : 0,
      scores: Number(row.score_count || 0),
      judges: Number(row.judge_count || 0),
    },
    champions: [],
  };
}

function getPlatformEvents(competitionId?: number): EventNews[] {
  const db = openAdminDb({ readonly: true });
  try {
    const rows = db.prepare(`
      SELECT
        c.id,
        c.name,
        c.registration_status,
        c.registration_public,
        COALESCE(c.start_date, '') AS start_date,
        COALESCE(c.end_date, '') AS end_date,
        COALESCE(c.location, '') AS location,
        COALESCE(c.description, '') AS description,
        COALESCE(c.cover_url, '') AS cover_url,
        (SELECT COUNT(*) FROM event_groups g WHERE g.competition_id = c.id) AS group_count,
        (SELECT COUNT(*) FROM event_players p WHERE p.competition_id = c.id AND p.audit_status != 'rejected' AND p.status NOT IN ('withdrawn', 'cancelled')) AS player_count,
        COALESCE(scores.score_count, 0) AS score_count,
        (SELECT COUNT(DISTINCT gj.judge_id) FROM event_group_judges gj WHERE gj.competition_id = c.id) AS judge_count
      FROM event_competitions c
      LEFT JOIN (SELECT competition_id, COUNT(*) AS score_count FROM event_scores GROUP BY competition_id) scores ON scores.competition_id = c.id
      WHERE c.status = 'published' ${competitionId ? 'AND c.id = ?' : ''}
      ORDER BY date(c.start_date) DESC, c.id DESC
    `).all<PlatformEventRow>(...(competitionId ? [competitionId] : []));

    return rows.map(platformEventToNews);
  } finally {
    db.close();
  }
}

export function getEventsNews(): EventNews[] {
  // Visibility switches must take effect on the next request; do not cache registrations.

  let archived: EventNews[] = [];
  try {
    archived = getArchivedEvents();
  } catch (error) {
    console.warn('历史赛事报道数据暂不可用。', error);
  }

  try {
    const platformEvents = getPlatformEvents();
    const platformById = new Map(platformEvents.map((item) => [getEventCompetitionId(item), item]));
    const archivedIds = new Set<number>();
    const merged = archived.map((item) => {
      if (item.reportType === 'course') return item;
      const competitionId = getEventCompetitionId(item);
      if (!competitionId) return item;
      archivedIds.add(competitionId);
      const platform = platformById.get(competitionId);
      if (!platform) return { ...item, registrationPublic: false, summary: "报名信息暂未公开", content: "", facts: undefined, champions: [], stats: { ...item.stats, players: 0 } };

      return {
        ...item,
        title: platform.title,
        date: platform.date,
        dateRange: platform.dateRange,
        location: platform.location,
        registrationStatus: platform.registrationStatus,
        registrationPublic: platform.registrationPublic,
        coverImage: item.coverImage || platform.coverImage,
        stats: platform.stats,
        summary: platform.summary,
        content: platform.registrationPublic ? item.content : platform.content,
        facts: platform.registrationPublic ? item.facts : undefined,
        champions: platform.registrationPublic ? item.champions : [],
      };
    });

    platformEvents.forEach((item) => {
      const competitionId = getEventCompetitionId(item);
      if (competitionId && !archivedIds.has(competitionId)) merged.push(item);
    });

    cachedEvents = merged.filter(isPublicEvent).sort((a, b) => b.date.localeCompare(a.date));
    return cachedEvents;
  } catch (error) {
    console.warn('数字化平台赛事数据暂不可用，已使用历史报道数据。', error);
    cachedEvents = archived.filter(isPublicEvent).map(item => item.reportType === "course" ? item : { ...item, registrationPublic: false, summary: "赛事报名信息暂未公开", content: "", facts: undefined, champions: [], stats: { ...item.stats, players: 0 } });
    return cachedEvents;
  }
}

export const getEventNewsBySlug = cache((slug: string): EventNews | undefined => {
  let archived: EventNews | undefined;
  try { archived = getArchivedEvents().find(item => item.slug === slug || item.id === slug); } catch {}
  if (archived?.reportType === 'course') return archived;
  const match = (archived?.id || slug).match(/^event-\d{4}-(\d+)$/);
  if (!match) return archived;
  let platform: EventNews | undefined;
  try { platform = getPlatformEvents(Number(match[1]))[0]; } catch (error) { console.warn('赛事数据暂不可用', error); }
  if (!archived) return platform && (platform.slug === slug || platform.id === slug) && isPublicEvent(platform) ? platform : undefined;
  if (!platform) return { ...archived, registrationPublic: false, summary: '报名信息暂未公开', content: '', facts: undefined, champions: [], stats: { ...archived.stats, players: 0 } };
  return {
    ...archived, title: platform.title, date: platform.date, dateRange: platform.dateRange,
    location: platform.location, registrationStatus: platform.registrationStatus,
    registrationPublic: platform.registrationPublic, coverImage: archived.coverImage || platform.coverImage,
    stats: platform.stats, summary: platform.summary,
    content: platform.registrationPublic ? archived.content : platform.content,
    facts: platform.registrationPublic ? archived.facts : undefined,
    champions: platform.registrationPublic ? archived.champions : [],
  };
});

export function getEventStatus(item: EventNews, now = Date.now()): 'ended' | 'registering' {
  if (item.registrationStatus === 'closed') return 'ended';

  const dateMatches = item.dateRange.match(/\d{4}-\d{2}-\d{2}/g);
  const endDate = dateMatches?.at(-1) || item.date;
  const endOfEvent = new Date(`${endDate}T23:59:59+08:00`).getTime();

  if (Number.isFinite(endOfEvent) && endOfEvent < now) return 'ended';
  return item.registrationStatus === 'open' || Number.isFinite(endOfEvent) ? 'registering' : 'ended';
}

export function getEventCompetitionId(item: EventNews): number | null {
  const match = (item.id || item.slug).match(/^event-\d{4}-(\d+)$/);
  if (!match) return null;

  const competitionId = Number(match[1]);
  return Number.isSafeInteger(competitionId) && competitionId > 0 ? competitionId : null;
}
