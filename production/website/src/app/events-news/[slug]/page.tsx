import styles from '../events.module.css';
import LiveEventResultsRefresh from '@/components/events/LiveEventResultsRefresh';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CalendarDays, Gavel, MapPin, Trophy } from 'lucide-react';
import StudentProtectedLink from '@/components/StudentProtectedLink';
import PublicJudges from '@/components/events/PublicJudges';
import EventGroupSearch from '@/components/events/EventGroupSearch';
import EventPeopleSearch from '@/components/events/EventPeopleSearch';
import { getEventCompetitionId, getEventNewsBySlug, getEventStatus } from '@/lib/events-news';
import { loadConfiguredEventGroupCount, loadPublicEventJudges, loadPublicEventGroups, loadPublicEventPlayers, type PublicEventGroup, type PublicEventPlayer } from '@/lib/public-event-data';

export const dynamic = 'force-dynamic';
const panels = [['overview', '概览'], ['groups', '组别'], ['players', '选手'], ['judges', '评委'], ['results', '成绩']] as const;

export default async function EventDetailPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ panel?: string }>;
}) {
  const { slug } = await params;
  const item = getEventNewsBySlug(slug);
  if (!item || item.reportType === 'course') notFound();
  const requestedPanel = (await searchParams)?.panel;
  const panel = panels.some(([key]) => key === requestedPanel) ? requestedPanel! : 'groups';
  const competitionId = getEventCompetitionId(item);
  const registrationOpen = getEventStatus(item) === 'registering';
  let groupCount = item.stats.groups;
  let groups: PublicEventGroup[] = [], players: PublicEventPlayer[] = [];
  let judges: ReturnType<typeof loadPublicEventJudges> = [];
  let loadError = false;
  try {
    if (competitionId) {
      groupCount = loadConfiguredEventGroupCount(competitionId);
      if (panel === 'groups') groups = loadPublicEventGroups(competitionId);
      if (panel === 'judges') judges = loadPublicEventJudges(competitionId);
      if (panel === 'players' || panel === 'results') players = loadPublicEventPlayers(competitionId);
    }
  } catch (error) {
    console.error('赛事公开信息加载失败:', error);
    loadError = true;
  }
  const baseHref = `/events/${item.slug}`;
  return <div data-event-detail="true" className={`min-h-screen pt-20 md:pt-28 ${styles.detail} ${styles.conceptDetail}`}>
    <LiveEventResultsRefresh />
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
      <Link href="/events" className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-text-muted hover:text-crimson"><ArrowLeft size={18} />赛事详情</Link>
      <section className={styles.conceptHero}>
        <div className={styles.cover}>
          {item.coverImage ? <Image src={`/api/events-news/media/${item.slug}?w=960`} alt={item.title} fill unoptimized priority className="object-cover" /> : <div className="flex h-full items-center justify-center"><Trophy className="text-gold-dark" size={42} /></div>}
          <span className={styles.coverStatus}>{registrationOpen ? '报名中' : '已结束'}</span>
        </div>
        <div className={styles.eventHeading}>
          <h1>{item.title}</h1>
          <div className={styles.inlineSummary}>
            <div><strong>{loadError ? '—' : groupCount}</strong><span>组别</span></div>
            <div aria-label={item.registrationPublic === false ? '选手人数尚未公开' : undefined}><strong>{item.registrationPublic === false ? '—' : item.stats.players}</strong><span>选手</span></div>
            <div><strong>{item.stats.judges}</strong><span>评委</span></div>
          </div>
        </div>
        <div className={styles.meta}><div><CalendarDays size={16} />{item.dateRange}</div><div><MapPin size={16} />{item.location}</div></div>
        <p className={styles.organizer}>主办方：{item.organizer || '待公布'}</p>
      </section>
      <nav className={styles.panelNav} aria-label="赛事内容">
        {panels.map(([key, label]) => <Link key={key} prefetch={false} href={`${baseHref}?panel=${key}`} aria-current={panel === key ? 'page' : undefined}>{label}</Link>)}
      </nav>
      <section className={styles.detailPanel}>
        {loadError ? <div role="alert" className="rounded-xl bg-white p-6 text-center"><p>赛事信息暂时加载失败，请重试。</p><Link href={`${baseHref}?panel=${panel}`} className="mt-3 inline-flex min-h-11 items-center font-semibold text-crimson">重新加载</Link></div> : <>
          {panel === 'groups' && <EventGroupSearch groups={groups} slug={item.slug} registrationOpen={registrationOpen} />}
          {panel === 'overview' && <div className="rounded-xl bg-white p-5"><h2 className="text-xl font-bold text-text">赛事信息</h2><dl className="mt-4 space-y-3 text-sm text-text-muted"><div className="flex justify-between gap-4"><dt>主办方</dt><dd>{item.organizer || '待公布'}</dd></div><div className="flex justify-between gap-4"><dt>比赛时间</dt><dd>{item.dateRange}</dd></div><div className="flex justify-between gap-4"><dt>比赛地点</dt><dd>{item.location}</dd></div></dl><p className="mt-5 leading-7 text-text-muted">{item.summary}</p><Link className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-crimson" href={`/dance-circle/${item.slug}`}>查看赛事介绍</Link><StudentProtectedLink href={`${baseHref}/judge`} className="ml-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-crimson"><Gavel size={16} />评委入口</StudentProtectedLink></div>}
          {panel === 'players' && <EventPeopleSearch players={players} slug={item.slug} />}
          {panel === 'judges' && <PublicJudges judges={judges} eventName={item.title} />}
          {panel === 'results' && <EventPeopleSearch players={players} slug={item.slug} results />}
        </>}
      </section>
    </div>
    <div className={styles.registrationBar}><div>
      <StudentProtectedLink prefetch={false} href="/dashboard/events">我的报名</StudentProtectedLink>
      {registrationOpen ? <StudentProtectedLink documentNavigation prefetch={false} href={`${baseHref}/register`}>立即报名</StudentProtectedLink> : <span aria-disabled="true">报名已关闭</span>}
      <StudentProtectedLink prefetch={false} href={`${baseHref}/judge`}>评委入口</StudentProtectedLink>
    </div></div>
  </div>;
}
