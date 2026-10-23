import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CalendarDays, ChevronRight, Gavel, MapPin, Trophy } from 'lucide-react';
import StudentProtectedLink from '@/components/StudentProtectedLink';
import EventGroupSearch from '@/components/events/EventGroupSearch';
import { getEventCompetitionId, getEventNewsBySlug, getEventStatus } from '@/lib/events-news';
import { loadPublicEventGroups, type PublicEventGroup } from '@/lib/public-event-data';

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

  return (
    <div className="min-h-screen bg-warm-white pb-16 pt-20 md:pb-24 md:pt-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Link href="/events" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-text-muted hover:text-crimson">
          <ArrowLeft className="h-4 w-4" /> 返回赛事平台
        </Link>

        <section className="overflow-hidden rounded-2xl bg-[#1A1A1A] text-white shadow-lg">
          <div className="grid md:grid-cols-[0.9fr_1.1fr]">
            <div className="relative h-32 bg-black/20 sm:h-40 md:h-auto md:min-h-[320px]">
              {item.coverImage ? (
                <Image src={`/api/events-news/media/${item.slug}?w=960`} alt={item.title} fill unoptimized priority className="object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center bg-gradient-to-br from-crimson-dark to-gold-dark">
                  <Trophy className="h-12 w-12 text-gold md:h-16 md:w-16" />
                </div>
              )}
            </div>
            <div className="p-4 md:p-7">
              {status === 'registering' ? (
                <span className="inline-flex rounded-full bg-crimson px-2.5 py-0.5 text-[11px] font-semibold text-white">正在报名</span>
              ) : (
                <Link href={`/dance-circle/${item.slug}`} className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-gold transition hover:bg-white/20">
                  赛事报道 <ChevronRight className="h-3 w-3" />
                </Link>
              )}
              <h1 className="mt-2 font-serif text-xl font-bold leading-snug md:text-3xl">{item.title}</h1>
              <div className="mt-3 space-y-1.5 text-xs text-white/70 md:text-sm">
                <div className="flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5 text-gold" />{item.dateRange}</div>
                <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-gold" />{item.location}</div>
              </div>
              <p className="mt-3 line-clamp-2 text-xs leading-5 text-white/65 md:text-sm">{item.summary}</p>
              <div className="mt-3 grid grid-cols-3 gap-3 border-t border-white/10 pt-3 text-center">
                <div><strong className="block text-lg leading-none text-gold">{groups.length || item.stats.groups}</strong><span className="mt-1 block text-[10px] text-white/55">组别</span></div>
                <div><strong className="block text-lg leading-none text-gold">{item.registrationPublic === false ? '暂未公开' : item.stats.players}</strong><span className="mt-1 block text-[10px] text-white/55">选手</span></div>
                <div><strong className="block text-lg leading-none text-gold">{item.stats.judges}</strong><span className="mt-1 block text-[10px] text-white/55">评委</span></div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {status === 'registering' ? (
                  <StudentProtectedLink documentNavigation prefetch={false} href={`/events/${item.slug}/register`} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-crimson px-3 text-sm font-semibold text-white">点击报名 <ChevronRight className="h-4 w-4" /></StudentProtectedLink>
                ) : (
                  <span className="inline-flex h-10 cursor-not-allowed items-center justify-center rounded-lg border border-white/15 bg-white/5 px-3 text-sm font-semibold text-white/55" aria-disabled="true">报名结束</span>
                )}
                <StudentProtectedLink href={`/events/${item.slug}/judge`} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-3 text-sm font-semibold text-white">
                  <Gavel className="h-4 w-4 text-gold" />评委入口
                </StudentProtectedLink>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 md:mt-10">
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
