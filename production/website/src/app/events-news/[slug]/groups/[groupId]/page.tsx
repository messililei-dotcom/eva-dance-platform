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
    <div className="min-h-screen bg-warm-white pb-16 pt-20 md:pb-24 md:pt-28">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <Link href={`/events/${event.slug}`} className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-text-muted hover:text-crimson">
          <ArrowLeft className="h-4 w-4" /> 返回赛事组别
        </Link>

        <section className="rounded-2xl bg-[#1A1A1A] p-5 text-white shadow-lg md:p-8">
          <div className="flex items-center gap-2 text-xs font-semibold text-gold"><Trophy className="h-4 w-4" />{event.title}</div>
          <h1 className="mt-3 font-serif text-2xl font-bold leading-snug md:text-4xl">{group.name}</h1>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-white/65">
            {group.age_range && <span>{group.age_range}</span>}
            {group.dance_type && <span>{group.dance_type}</span>}
            {group.entry_type && <span>{formatPublicEntryType(group.entry_type)}</span>}
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 border-t border-white/10 pt-5">
            <div><strong className="block text-2xl text-gold">{group.registration_public === 1 ? group.player_count : '暂未公开'}</strong><span className="text-xs text-white/55">已报名选手</span></div>
            <div><strong className="block text-2xl text-gold">{group.ranked_count}</strong><span className="text-xs text-white/55">已公布成绩</span></div>
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-5 flex items-end justify-between gap-4">
            <h2 className="font-serif text-2xl font-bold text-text md:text-3xl">{group.registration_public === 1 ? '选手列表' : '已公示成绩'}</h2>
            <span className="inline-flex items-center gap-1.5 text-sm text-text-muted"><Users className="h-4 w-4" />{players.length} 位</span>
          </div>

          <form className="mb-5 flex gap-2" role="search"><input name="q" aria-label="搜索组别或选手" defaultValue={query} placeholder="搜索组别、选手姓名或编号" className="min-w-0 flex-1 rounded-lg border border-sand bg-white px-4 py-3 text-sm outline-none focus:border-gold-dark" /><button className="rounded-lg bg-crimson px-5 text-sm text-white">搜索</button></form>
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
                      {player.rank_no === 1 ? <span className="text-xl leading-none" role="img" aria-label="冠军金色奖杯">🏆</span>
                        : player.rank_no === 2 ? <span className="text-xl leading-none" style={{ filter: 'grayscale(1) brightness(1.22) contrast(0.9)' }} role="img" aria-label="亚军银色奖杯">🏆</span>
                          : player.rank_no === 3 ? <span className="text-xl leading-none" style={{ filter: 'sepia(1) saturate(1.8) brightness(0.72)' }} role="img" aria-label="季军铜色奖杯">🏆</span>
                            : player.rank_no || '—'}
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
