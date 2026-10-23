import type { Metadata } from 'next';
import { getEventCompetitionId, getEventNewsBySlug } from '@/lib/events-news';
import { loadPublicEventGroup, loadPublicPlayerDetail } from '@/lib/public-event-data';
import { buildShareMetadata } from '@/lib/share-metadata';

export function eventShareMetadata(slug: string): Metadata {
  const event = getEventNewsBySlug(slug);
  if (!event || event.reportType === 'course') return {};
  return buildShareMetadata({
    title: event.title,
    description: event.summary,
    path: `/events/${encodeURIComponent(event.slug)}`,
    image: event.coverImage ? `/api/events-news/media/${encodeURIComponent(event.slug)}` : undefined,
    type: 'article',
    publishedTime: event.date,
  });
}

export function eventOperationMetadata(slug: string, title: string): Metadata {
  const publicMetadata = eventShareMetadata(slug);
  return {
    ...publicMetadata,
    title,
    robots: { index: false, follow: false, noarchive: true },
  };
}

export function eventGroupShareMetadata(slug: string, groupIdValue: string): Metadata {
  const event = getEventNewsBySlug(slug);
  const competitionId = event ? getEventCompetitionId(event) : null;
  const groupId = Number(groupIdValue);
  if (!event || !competitionId || !Number.isInteger(groupId)) return eventShareMetadata(slug);

  try {
    const group = loadPublicEventGroup(competitionId, groupId);
    if (!group) return eventShareMetadata(slug);
    return buildShareMetadata({
      title: `${group.name} · ${event.title}`,
      shareTitle: group.name,
      description: `查看${event.title}${group.name}的选手名单、成绩与排名。`,
      path: `/events/${encodeURIComponent(slug)}/groups/${group.id}`,
      image: event.coverImage ? `/api/events-news/media/${encodeURIComponent(slug)}` : undefined,
      type: 'article',
    });
  } catch {
    return eventShareMetadata(slug);
  }
}

export function eventPlayerShareMetadata(
  slug: string,
  groupIdValue: string,
  playerIdValue: string,
): Metadata {
  const event = getEventNewsBySlug(slug);
  const competitionId = event ? getEventCompetitionId(event) : null;
  const groupId = Number(groupIdValue);
  const playerId = Number(playerIdValue);
  if (!event || !competitionId || !Number.isInteger(groupId) || !Number.isInteger(playerId)) {
    return eventShareMetadata(slug);
  }

  try {
    const detail = loadPublicPlayerDetail(competitionId, groupId, playerId);
    if (!detail) return eventGroupShareMetadata(slug, groupIdValue);
    return buildShareMetadata({
      title: `${detail.player.name} · ${detail.player.group_name}`,
      shareTitle: `${detail.player.name} · 比赛成绩`,
      description: `查看${detail.player.name}在${event.title}${detail.player.group_name}的成绩与排名。`,
      path: `/events/${encodeURIComponent(slug)}/groups/${groupId}/players/${playerId}`,
      image: event.coverImage ? `/api/events-news/media/${encodeURIComponent(slug)}` : undefined,
      type: 'article',
    });
  } catch {
    return eventGroupShareMetadata(slug, groupIdValue);
  }
}
