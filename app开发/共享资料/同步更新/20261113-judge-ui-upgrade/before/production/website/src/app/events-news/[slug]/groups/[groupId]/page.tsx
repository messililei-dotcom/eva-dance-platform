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
  searchParams: Promise<{ q?: string }>;
}) {
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
  const visiblePlayers = players.filter(player => [group.name, player.name, player.player_no, player.organization, player.teacher].join(' ').toLocaleLowerCase().includes(query.toLocaleLowerCase()));

  return (
    <div className={`min-h-screen pb-16 pt-20 md:pb-24 md:pt-28 ${styles.detail}`}>
      <LiveEventResultsRefresh />
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <Link href={`/events/${event.slug}`} className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-text-muted hover:text-crimson">
          <ArrowLeft className="h-4 w-4" /> 返回赛事组别
        </Link>

        <section className={styles.groupHero}>
          <div className="flex items-center gap-2 text-sm font-medium text-text-muted"><Trophy className="h-4 w-4" />{event.title}</div>
          <h1 >{group.name}</h1>
          <div className={styles.groupMeta}>
            {group.age_range && <span>{group.age_range}</span>}
            {group.dance_type && <span>{group.dance_type}</span>}
            {group.entry_type && <span>{formatPublicEntryType(group.entry_type)}</span>}
          </div>
          <p className="mt-4 text-sm text-text-muted" role="status">{group.ranking_complete === 1 ? '本组评分已结束，排名已公示' : '组内节目全部完成后统一公示排名'} · 每5秒自动更新</p>
          <div className="mt-6 grid grid-cols-2 gap-3 border-t border-sand/50 pt-5">
            <div><strong className="block text-2xl text-crimson">{group.registration_public === 1 ? group.player_count : '暂未公开'}</strong><span className="text-xs text-text-muted">已报名选手</span></div>
            <div><strong className="block text-2xl text-crimson">{group.ranked_count}</strong><span className="text-xs text-text-muted">已公布成绩</span></div>
          </div>
        </section>

        {players.some(player => player.rank_no && player.rank_no <= 3) && <section aria-label="前三名荣誉榜">
          <h2 className={styles.podiumTitle}>荣誉榜</h2><p className="text-center text-sm text-text-muted">成绩经赛事平台审核发布</p>
          <div className={styles.podium}>
            {players.filter(player => player.rank_no && player.rank_no <= 3).sort((a,b) => ([2,1,3].indexOf(a.rank_no!) - [2,1,3].indexOf(b.rank_no!))).map(player => <Link prefetch={false} key={player.id} data-rank={player.rank_no} href={`/events/${event.slug}/groups/${group.id}/players/${player.id}`}>
              <PlayerAvatar name={player.name} src={player.avatar_url} /><span className="inline-flex items-center gap-1 text-sm text-gold-dark"><Trophy className="h-4 w-4" />{player.rank_no === 1 ? '冠军' : player.rank_no === 2 ? '亚军' : '季军'}</span><span className="break-all font-semibold">{player.name}</span><strong>{formatPublicScore(player.published_total)}<span className="ml-1 text-xs font-normal">分</span></strong>
            </Link>)}
          </div>
        </section>}
        <section className="mt-8">
          <div className="mb-5 flex items-end justify-between gap-4">
            <h2 className="font-serif text-2xl font-bold text-text md:text-3xl">{group.ranked_count ? '成绩排名' : '参赛选手'}</h2>
            <span className="inline-flex items-center gap-1.5 text-sm text-text-muted"><Users className="h-4 w-4" />{players.length} 位</span>
          </div>

          <form className="mb-5 flex gap-2" role="search"><input name="q" aria-label="搜索选手、编号或机构" defaultValue={query} placeholder="搜索选手、编号或机构" className="min-w-0 flex-1 rounded-lg border border-sand bg-white px-4 py-3 text-sm outline-none focus:border-gold-dark" /><button className="rounded-lg bg-crimson px-5 text-sm text-white">搜索</button></form>
          {visiblePlayers.length ? (
            <div className="space-y-3">
              {visiblePlayers.map((player) => (
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
                      {player.rank_no && player.rank_no <= 3 ? <Trophy className="h-5 w-5" aria-hidden="true" /> : player.rank_no || '—'}
                    </div>
                    <div className="mt-1 text-[10px] text-text-muted">
                      {player.rank_no === 1 ? '冠军' : player.rank_no === 2 ? '亚军' : player.rank_no === 3 ? '季军' : '排名'}
                    </div>
                  </div>
                  <PlayerAvatar name={player.name} src={player.avatar_url} />
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-text">{player.name}</div>
                    <div className="mt-1 truncate text-xs text-text-muted">
                      {[player.player_no && `编号 ${player.player_no}`, player.organization, player.teacher && `指导老师 ${player.teacher}`].filter(Boolean).join(' · ') || '报名信息已确认'}
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
      </div>
    </div>
  );
}
