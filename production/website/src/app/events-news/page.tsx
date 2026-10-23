import Image from 'next/image';
import Link from 'next/link';
import { CalendarDays, ChevronRight, MapPin, Medal, Trophy, Users } from 'lucide-react';
import StudentProtectedLink from '@/components/StudentProtectedLink';
import EventPlatformSearch from '@/components/events/EventPlatformSearch';
import { getEventsNews, getEventStatus } from '@/lib/events-news';
import { buildShareMetadata } from '@/lib/share-metadata';

const statLabels = [
  { key: 'groups', label: '组别' },
  { key: 'players', label: '选手' },
  { key: 'judges', label: '评委' },
] as const;

export const metadata = buildShareMetadata({
  title: 'AiwaRaks赛事平台',
  shareTitle: 'AiwaRaks东方舞赛事',
  description: '伊娃东方舞 AiwaRaks 赛事平台，统一展示正在报名与历届东方舞赛事。',
  path: '/events',
});

export const dynamic = 'force-dynamic';
const EVENTS_PER_PAGE = 12;

export default async function EventsNewsPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string }>;
}) {
  const news = getEventsNews().filter((item) => item.reportType !== 'course');
  const requestedPage = Number((await searchParams)?.page || 1);
  const totalPages = Math.max(1, Math.ceil(news.length / EVENTS_PER_PAGE));
  const currentPage = Number.isInteger(requestedPage)
    ? Math.min(Math.max(requestedPage, 1), totalPages)
    : 1;
  const pagedNews = news.slice((currentPage - 1) * EVENTS_PER_PAGE, currentPage * EVENTS_PER_PAGE);
  const totalPlayers = news.reduce((sum, item) => sum + item.stats.players, 0);
  const totalScores = news.reduce((sum, item) => sum + item.stats.scores, 0);

  return (
    <div data-mobile-surface="events" className="mobile-events-surface min-h-screen bg-warm-white">
      <section className="bg-[#1A1A1A] text-white">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 pb-6 pt-20 sm:px-6 md:gap-8 md:pb-14 md:pt-28 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
          <div>
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-medium text-gold md:gap-2 md:px-4 md:py-1.5 md:text-sm">
                <Trophy className="h-4 w-4" />
                东方舞赛事平台
              </span>
              <h1 className="mt-3 font-serif text-3xl font-bold leading-tight md:mt-5 md:text-6xl">
                AiwaRaks赛事平台
              </h1>
            </div>
          </div>

          <div>
            <div className="grid grid-cols-3 divide-x divide-white/10 border border-white/10 bg-white/[0.06]">
              {[
                { value: news.length, label: '赛事总数', icon: Trophy },
                { value: totalPlayers, label: news.some(item => item.registrationPublic === false) ? '已公开参与' : '累计参与', icon: Users },
                { value: totalScores, label: '记录数据', icon: Medal },
              ].map((item) => (
                <div key={item.label} className="min-w-0 px-2 py-3 text-center md:p-5">
                  <item.icon className="mx-auto mb-1.5 h-4 w-4 text-gold md:mb-3 md:h-5 md:w-5" />
                  <div className="truncate font-serif text-lg font-bold md:text-3xl">{item.value.toLocaleString()}</div>
                  <div className="mt-0.5 whitespace-nowrap text-[10px] text-white/60 md:mt-1 md:text-sm">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="event-list" className="scroll-mt-20 py-8 md:py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-5 flex items-center justify-between gap-3 md:mb-8 md:gap-6">
            <h2 className="shrink-0 font-serif text-2xl font-bold text-text md:text-4xl">全部赛事</h2>
            <EventPlatformSearch events={news.map(({ slug, title, location }) => ({ slug, title, location }))} />
          </div>

          <div className="grid grid-cols-2 gap-3 md:gap-5 xl:grid-cols-3">
            {pagedNews.map((item, index) => {
              const status = getEventStatus(item);

              return (
                <div key={item.slug}>
                  <article className="group flex h-full flex-col overflow-hidden rounded-lg border border-sand/50 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
                    <a href={`/events/${item.slug}`} aria-label={`查看赛事：${item.title}`} className="flex flex-1 flex-col">
                      <div className="relative aspect-[4/3] bg-[#1A1A1A]">
                      {item.coverImage ? (
                        <Image
                          src={`/api/events-news/media/${item.slug}?w=640`}
                          alt={item.title}
                          fill
                          unoptimized
                          priority={index === 0}
                          sizes="(min-width: 1280px) 31vw, (min-width: 640px) 48vw, 100vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-gradient-to-br from-crimson-dark to-gold-dark text-white">
                          <Trophy className="h-12 w-12 text-gold" />
                        </div>
                      )}
                      <div className={`absolute left-4 top-4 rounded-full px-3 py-1 text-xs font-medium text-white backdrop-blur ${
                        status === 'registering' ? 'bg-crimson/90' : 'bg-[#1A1A1A]/75'
                      }`}>
                        {status === 'registering' ? '正在报名' : '圆满结束'}
                      </div>
                      </div>

                      <div className="flex flex-1 flex-col p-3 pb-0 md:p-5 md:pb-0">
                      <div className="mb-2 flex flex-col gap-1 text-[10px] text-text-muted md:mb-3 md:flex-row md:flex-wrap md:gap-3 md:text-xs">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5 text-gold-dark" />
                          {item.dateRange}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-gold-dark" />
                          {item.location}
                        </span>
                      </div>
                      <h3 className="line-clamp-2 font-serif text-base font-bold leading-snug text-text transition-colors group-hover:text-crimson md:text-xl">
                        {item.title}
                      </h3>
                      <p className="mt-3 hidden line-clamp-3 text-sm leading-6 text-text-secondary md:block">
                        {item.summary}
                      </p>
                      <div className="mt-3 grid grid-cols-3 gap-1 border-y border-sand/40 py-2 md:mt-5 md:gap-2 md:py-3">
                        {statLabels.map(({ key, label }) => (
                          <div key={key}>
                            <div className="text-base font-bold text-gold-dark md:text-lg">{key === 'players' && item.registrationPublic === false ? '暂未公开' : item.stats[key].toLocaleString()}</div>
                            <div className="text-[10px] text-text-muted md:text-xs">{item.statLabels?.[key] || label}</div>
                          </div>
                        ))}
                      </div>
                      </div>
                    </a>
                    <div className="p-3 pt-3 md:p-5 md:pt-4">
                      {status === 'registering' ? (
                        <div className="grid grid-cols-2 gap-2">
                        <StudentProtectedLink
                          documentNavigation prefetch={false} href={`/events/${item.slug}/register`}
                          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-crimson px-3 py-2 text-xs font-semibold text-white md:gap-2 md:text-sm"
                        >
                          报名
                          <ChevronRight className="h-4 w-4" />
                        </StudentProtectedLink>
                        <StudentProtectedLink
                          documentNavigation prefetch={false} href={`/events/${item.slug}/judge`}
                          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-gold-dark/40 bg-warm-white px-2 py-2 text-xs font-semibold text-gold-dark transition hover:bg-sand/30 md:gap-2 md:text-sm"
                        >
                          评委入口
                          <ChevronRight className="h-4 w-4 shrink-0" />
                        </StudentProtectedLink>
                        </div>
                      ) : (
                        <Link href={`/events/${item.slug}`} className="inline-flex w-full items-center justify-center gap-1.5 text-xs font-semibold text-crimson md:gap-2 md:text-sm">
                          查看赛事
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      )}
                    </div>
                  </article>
                </div>
              );
            })}
          </div>
          {totalPages > 1 ? (
            <nav className="mt-8 flex items-center justify-center gap-3" aria-label="赛事分页">
              {currentPage > 1 ? (
                <a rel="prev" className="rounded-md border border-sand bg-white px-4 py-2 text-sm font-semibold text-text" href={`/events?page=${currentPage - 1}#event-list`}>
                  上一页
                </a>
              ) : null}
              <span aria-live="polite" className="text-sm text-text-muted">第 {currentPage} / {totalPages} 页</span>
              {currentPage < totalPages ? (
                <a rel="next" className="rounded-md bg-crimson px-4 py-2 text-sm font-semibold text-white" href={`/events?page=${currentPage + 1}#event-list`}>
                  下一页
                </a>
              ) : null}
            </nav>
          ) : null}
        </div>
      </section>
    </div>
  );
}
