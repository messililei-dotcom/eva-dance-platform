import styles from '../events.module.css';
import LiveEventResultsRefresh from '@/components/events/LiveEventResultsRefresh';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CalendarDays, ChevronRight, Gavel, MapPin, Trophy } from 'lucide-react';
import StudentProtectedLink from '@/components/StudentProtectedLink';
import PublicJudges from '@/components/events/PublicJudges';
import EventGroupSearch from '@/components/events/EventGroupSearch';
import { getEventCompetitionId, getEventNewsBySlug, getEventStatus } from '@/lib/events-news';
import { loadPublicEventJudges, loadPublicEventGroups, type PublicEventGroup } from '@/lib/public-event-data';

export const dynamic = 'force-dynamic';

export default async function EventDetailPage({ params }: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = getEventNewsBySlug(slug);
  if (!item || item.reportType === 'course') notFound();

  const competitionId = getEventCompetitionId(item);
  const status = getEventStatus(item);
  let groups: PublicEventGroup[] = [];
  if (competitionId) {
    try {
      groups = loadPublicEventGroups(competitionId);
    } catch (error) {
      console.error('赛事组别加载失败:', error);
    }
  }

  const judges=competitionId ? loadPublicEventJudges(competitionId) : [];

  return (
    <div className={`min-h-screen pb-16 pt-20 md:pb-24 md:pt-28 ${styles.detail}`}>
      <LiveEventResultsRefresh />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Link href="/events" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-text-muted hover:text-crimson">
          <ArrowLeft className="h-4 w-4" /> 返回赛事平台
        </Link>

        <section className={styles.detailHero}>
            <div className={styles.cover}>
              {item.coverImage ? (
                <Image src={`/api/events-news/media/${item.slug}?w=960`} alt={item.title} fill unoptimized priority className="object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center bg-gradient-to-br from-crimson-dark to-gold-dark">
                  <Trophy className="h-12 w-12 text-gold md:h-16 md:w-16" />
                </div>
              )}
            </div>
            <div className={styles.detailBody}>
              {status === 'registering' ? (
                <span className="inline-flex rounded-full bg-crimson px-2.5 py-0.5 text-[11px] font-semibold text-white">正在报名</span>
              ) : (
                <Link href={`/dance-circle/${item.slug}`} className="inline-flex items-center gap-1 rounded-full bg-sand/30 px-3 py-1 text-sm font-semibold text-gold-dark">
                  赛事报道 <ChevronRight className="h-3 w-3" />
                </Link>
              )}
              <h1 className="mt-2">{item.title}</h1>
              <div className={styles.meta}>
                <div className="flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5 text-gold-dark" />{item.dateRange}</div>
                <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-gold-dark" />{item.location}</div>
              </div>
              <p className="mt-3 line-clamp-2 text-sm leading-6 text-text-muted">{item.summary}</p>
              <div className={styles.summary}>
                <div><strong >{groups.length || item.stats.groups}</strong><span >组别</span></div>
                <div><strong >{item.registrationPublic === false ? '暂未公开' : item.stats.players}</strong><span >选手</span></div>
                <div><strong >{item.stats.judges}</strong><span >评委</span></div>
              </div>
              <div className={styles.actions}>
                {status === 'registering' ? (
                  <StudentProtectedLink documentNavigation prefetch={false} href={`/events/${item.slug}/register`} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-crimson px-3 text-sm font-semibold text-white">立即报名 <ChevronRight className="h-4 w-4" /></StudentProtectedLink>
                ) : (
                  <span className="inline-flex h-10 cursor-not-allowed items-center justify-center rounded-lg border border-sand bg-sand/20 px-3 text-sm font-semibold text-text-muted" aria-disabled="true">报名结束</span>
                )}
                <StudentProtectedLink href={`/events/${item.slug}/judge`} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-sand bg-white px-3 text-sm font-semibold text-text">
                  <Gavel className="h-4 w-4 text-gold-dark" />评委入口
                </StudentProtectedLink>
              </div>
            </div>
        </section>

        <PublicJudges judges={judges} eventName={item.title}/>
        <section id="event-groups" className="mt-6 scroll-mt-24 md:mt-10">
          {groups.length ? (
            <EventGroupSearch groups={groups} slug={item.slug} />
          ) : (
            <div className="rounded-xl border border-sand/50 bg-white p-8 text-center text-sm text-text-muted">组别信息暂未发布</div>
          )}
        </section>

      </div>
    </div>
  );
}
