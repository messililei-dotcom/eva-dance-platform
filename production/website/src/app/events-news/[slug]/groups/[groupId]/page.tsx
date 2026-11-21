import styles from '../../../events.module.css';
import LiveEventResultsRefresh from '@/components/events/LiveEventResultsRefresh';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ChevronRight, Medal, Trophy, Users } from 'lucide-react';
import PlayerAvatar from '@/components/events/PlayerAvatar';
import { getEventCompetitionId, getEventNewsBySlug } from '@/lib/events-news';
import {
  formatPublicEntryType,
  formatPublicScore,
  loadPublicEventGroup,
  loadPublicGroupPlayers,
} from '@/lib/public-event-data';

export const dynamic = 'force-dynamic';

export default async function EventGroupPage({ params, searchParams }: {
  params: Promise<{ slug: string; groupId: string }>;
  searchParams: Promise<{ q?: string; view?: string; all?: string }>;
}) {
  const expanded = (await searchParams).all === '1';
  const groupView = (await searchParams).view === 'players' ? 'players' : 'results';
  const query = String((await searchParams).q || '').trim().slice(0, 100);
  const { slug, groupId: groupIdValue } = await params;
  const event = getEventNewsBySlug(slug);
  const competitionId = event ? getEventCompetitionId(event) : null;
  const groupId = Number(groupIdValue);
  if (!event || event.reportType === 'course' || !competitionId || !Number.isInteger(groupId)) notFound();

  let group;
  let players;
  try {
    group = loadPublicEventGroup(competitionId, groupId);
    players = group ? loadPublicGroupPlayers(competitionId, groupId) : [];
  } catch (error) {
    console.error('赛事组别选手加载失败:', error);
    notFound();
  }
  if (!group) notFound();
  const visiblePlayers = players.filter(player => (groupView === 'players' || player.published_total !== null || !group.ranked_count) && [group.name, player.name, player.player_no, player.organization, player.teacher].join(' ').toLocaleLowerCase().includes(query.toLocaleLowerCase()));

  return (
    <div className={`min-h-screen pb-16 pt-20 md:pb-24 md:pt-28 ${styles.detail}`}>
      <LiveEventResultsRefresh />
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <Link href={`/events/${event.slug}`} className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-text-muted hover:text-crimson">
          <ArrowLeft className="h-4 w-4" /> 返回赛事组别
        </Link>

        <section className={styles.groupHero}>
          <div className="flex items-center gap-2 text-sm font-medium text-text-muted"><Trophy aria-hidden="true" className="h-4 w-4" />{event.title}</div>
          <h1 >{group.name}</h1>
          <div className={styles.groupMeta}>
            {group.age_range && <span>{group.age_range}</span>}
            {group.dance_type && <span>{group.dance_type}</span>}
            {group.entry_type && <span>{formatPublicEntryType(group.entry_type)}</span>}
          </div>
          <div className={styles.publicationLine}><span>{group.registration_public === 1 ? `${group.player_count} 位选手` : '报名信息未公开'}</span><span>{group.ranking_complete === 1 ? '✓ 成绩已公布' : group.ranked_count ? `已公示${group.ranked_count}项成绩` : '成绩待公布'}</span></div>
        </section>

        {players.some(player => player.rank_no && player.rank_no <= 3) && <section aria-label="前三名荣誉榜">
          <h2 className={styles.podiumTitle}>荣誉榜</h2><p className="text-center text-sm text-text-muted">成绩经赛事平台审核发布</p>
          <div className={styles.podium}>
            {players.filter(player => player.rank_no && player.rank_no <= 3).sort((a,b) => ([2,1,3].indexOf(a.rank_no!) - [2,1,3].indexOf(b.rank_no!))).map(player => <Link prefetch={false} key={player.id} data-rank={player.rank_no} href={`/events/${event.slug}/groups/${group.id}/players/${player.id}`}>
              <PlayerAvatar name={player.name} src={player.avatar_url} /><span className="inline-flex items-center gap-1 text-sm text-gold-dark"><Trophy aria-hidden="true" className={styles.podiumCup} />{player.rank_no === 1 ? '冠军' : player.rank_no === 2 ? '亚军' : '季军'}</span><span className="break-all font-semibold">{player.name}</span><strong>{formatPublicScore(player.published_total)}<span className="ml-1 text-xs font-normal">分</span></strong>
            </Link>)}
          </div>
        </section>}
        <section className="mt-8">
          <div className={styles.groupSegments}><Link aria-current={groupView === 'results' ? 'page' : undefined} href={`?view=results`}>成绩排名</Link><Link aria-current={groupView === 'players' ? 'page' : undefined} href={`?view=players`}>参赛选手</Link></div>          <form className="mb-5 flex gap-2" role="search"><input type="hidden" name="view" value={groupView} /><input name="q" aria-label="搜索选手、编号或机构" defaultValue={query} placeholder="搜索选手、编号或机构" className="min-w-0 flex-1 rounded-lg border border-sand bg-white px-4 py-3 text-sm outline-none focus:border-gold-dark" /><button className="rounded-lg bg-crimson px-5 text-sm text-white">搜索</button></form>
          {visiblePlayers.length ? (
            <div className={styles.groupRankingRows}>
              {(expanded ? visiblePlayers : visiblePlayers.slice(0,5)).map((player) => (
                <Link
                  key={player.id}
                  prefetch={false}
                  href={`/events/${event.slug}/groups/${group.id}/players/${player.id}`}
                  className="grid grid-cols-[44px_40px_minmax(0,1fr)_52px_16px] items-center gap-2 rounded-xl border border-sand/50 bg-white p-3 shadow-sm transition hover:border-gold-dark hover:shadow-md md:grid-cols-[64px_48px_minmax(0,1fr)_120px_24px] md:gap-4 md:p-5"
                >
                  <div className="text-center">
                    <div className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full font-bold ${
                      player.rank_no === 1 ? 'bg-[#FFF3D5] text-[#C78A0A]'
                        : player.rank_no === 2 ? 'bg-[#EEF1F4] text-[#929AA5]'
                          : player.rank_no === 3 ? 'bg-[#F6E2D3] text-[#B66A36]'
                            : player.rank_no ? 'bg-gold/20 text-gold-dark' : 'bg-warm-white text-text-muted'
                    }`} aria-label={player.rank_no ? `第 ${player.rank_no} 名` : '排名待公布'}>
                      {player.rank_no || '—'}
                    </div>
                    <div className="mt-1 text-[10px] text-text-muted">
                      {player.rank_no === 1 ? '冠军' : player.rank_no === 2 ? '亚军' : player.rank_no === 3 ? '季军' : '排名'}
                    </div>
                  </div>
                  <PlayerAvatar name={player.name} src={player.avatar_url} />
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-text">{player.name}</div>
                    <div className="mt-1 truncate text-xs text-text-muted">
                      {[player.performance_title && `节目《${player.performance_title}》`, player.player_no && `编号 ${player.player_no}`].filter(Boolean).join(' · ') || '报名信息已确认'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-crimson">{formatPublicScore(player.published_total)}</div>
                    <div className="mt-1 text-[10px] text-text-muted">最终得分</div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gold-dark" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-sand/50 bg-white py-16 text-center text-sm text-text-muted">
              <Medal className="mx-auto mb-3 h-8 w-8 text-gold-dark" />
              {query ? '未找到相关选手' : group.registration_public === 1 ? '该组别暂无已报名选手' : '报名信息暂未公开，已公示成绩将在这里展示'}
            </div>
          )}
        </section>
        {!expanded && visiblePlayers.length > 5 && <Link className={styles.showAllPlayers} href={`?view=${groupView}&q=${encodeURIComponent(query)}&all=1`}>查看全部{visiblePlayers.length}位选手 ↓</Link>}
        <Link className={styles.backEvent} href={`/events/${event.slug}`}>‹ 返回赛事</Link>
      </div>
    </div>
  );
}
