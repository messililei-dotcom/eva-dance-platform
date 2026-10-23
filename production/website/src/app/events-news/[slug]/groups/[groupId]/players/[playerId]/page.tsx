import PlayerAvatar from '@/components/events/PlayerAvatar';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Medal, Star, Trophy, UserRound } from 'lucide-react';
import { getEventCompetitionId, getEventNewsBySlug } from '@/lib/events-news';
import { formatPublicScore, loadPublicPlayerDetail } from '@/lib/public-event-data';

export const dynamic = 'force-dynamic';

function displayValue(value: string) {
  return value || '未填写';
}

export default async function EventPlayerPage({ params }: {
  params: Promise<{ slug: string; groupId: string; playerId: string }>;
}) {
  const { slug, groupId: groupIdValue, playerId: playerIdValue } = await params;
  const event = getEventNewsBySlug(slug);
  const competitionId = event ? getEventCompetitionId(event) : null;
  const groupId = Number(groupIdValue);
  const playerId = Number(playerIdValue);
  if (!event || event.reportType === 'course' || !competitionId || !Number.isInteger(groupId) || !Number.isInteger(playerId)) notFound();

  let detail;
  try {
    detail = loadPublicPlayerDetail(competitionId, groupId, playerId);
  } catch (error) {
    console.error('赛事选手详情加载失败:', error);
    notFound();
  }
  if (!detail) notFound();
  const { player, scores } = detail;

  return (
    <div className="min-h-screen bg-warm-white pb-16 pt-20 md:pb-24 md:pt-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <Link href={`/events/${event.slug}/groups/${groupId}`} className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-text-muted hover:text-crimson">
          <ArrowLeft className="h-4 w-4" /> 返回选手列表
        </Link>

        <section className="rounded-2xl bg-[#1A1A1A] p-4 text-white shadow-lg md:p-6">
          <div className="flex min-w-0 items-center gap-2 text-[11px] font-semibold text-gold"><Trophy className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{event.title}</span></div>
          <div className="mt-5 flex flex-col items-center gap-3 text-center">
            <PlayerAvatar name={player.name} src={player.avatar_url} size="large" />
            <div className="min-w-0">
              <h1 className="break-words font-serif text-2xl font-bold leading-tight">{player.name}</h1>
              <div className="mt-1 text-sm text-white/60">{player.group_name}</div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 border-t border-white/10 pt-3 text-center">
            <div><strong className="block text-xl leading-none text-gold">{player.rank_no || '—'}</strong><span className="mt-1 block text-[10px] text-white/55">组别排名</span></div>
            <div><strong className="block text-xl leading-none text-gold">{formatPublicScore(player.published_total)}</strong><span className="mt-1 block text-[10px] text-white/55">最终得分</span></div>
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-sand/50 bg-white p-3.5 shadow-sm md:p-5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-gold-dark"><UserRound className="h-3.5 w-3.5" />本组报名信息</div>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5">
            <div className="min-w-0"><div className="text-[10px] text-text-muted">参赛组别</div><div className="mt-0.5 truncate text-xs font-medium leading-tight text-text">{player.group_name}</div></div>
            <div className="min-w-0"><div className="text-[10px] text-text-muted">选手编号</div><div className="mt-0.5 truncate text-xs font-medium leading-tight text-text">{displayValue(player.player_no)}</div></div>
            <div className="min-w-0"><div className="text-[10px] text-text-muted">机构 / 舞蹈室</div><div className="mt-0.5 truncate text-xs font-medium leading-tight text-text">{displayValue(player.organization)}</div></div>
            <div className="min-w-0"><div className="text-[10px] text-text-muted">指导老师</div><div className="mt-0.5 truncate text-xs font-medium leading-tight text-text">{displayValue(player.teacher)}</div></div>
            <div className="min-w-0"><div className="text-[10px] text-text-muted">节目名称</div><div className="mt-0.5 truncate text-xs font-medium leading-tight text-text">{displayValue(player.performance_title)}</div></div>
            <div className="min-w-0"><div className="text-[10px] text-text-muted">报名时间</div><div className="mt-0.5 truncate text-xs font-medium leading-tight text-text">{player.registered_at ? player.registered_at.slice(0, 16).replace('T', ' ') : '未记录'}</div></div>
          </div>
        </section>

        <section className="mt-5 flex items-center justify-between gap-4 rounded-2xl bg-crimson p-4 text-white shadow-md md:p-6">
          <div className="flex items-center gap-3"><Medal className="h-8 w-8 text-gold" /><div><div className="text-xs text-white/70">最终评分</div><div className="mt-1 text-sm">排名第 {player.rank_no || '—'} 名</div></div></div>
          <div className="font-serif text-3xl font-bold">{formatPublicScore(player.published_total)}</div>
        </section>

        <section className="mt-5 rounded-2xl border border-sand/50 bg-white p-4 shadow-sm md:p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-gold-dark"><Star className="h-4 w-4" />评委评分</div>
            <span className="text-xs text-text-muted">{scores.length ? `${scores.length} 位评委` : '待公布'}</span>
          </div>
          {scores.length ? (
            <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
              {scores.map((score) => (
                <div key={score.id} className="flex min-w-0 flex-col items-center gap-2 rounded-xl border border-sand/40 bg-warm-white p-3 text-center">
                  <PlayerAvatar name={score.judge_name} src={score.avatar_url} size="medium" />
                  <div className="w-full min-w-0">
                    <div title={score.judge_name} className="truncate text-xs font-medium leading-tight text-text">{score.judge_name}</div>
                    {score.judge_title && <div className="mt-0.5 truncate text-[11px] leading-tight text-text-muted">{score.judge_title}</div>}
                  </div>
                  <div className="shrink-0 text-lg font-bold leading-none text-crimson">{score.score === null ? '***' : formatPublicScore(score.score)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-text-muted">评委评分暂未公布</div>
          )}
        </section>

      </div>
    </div>
  );
}
