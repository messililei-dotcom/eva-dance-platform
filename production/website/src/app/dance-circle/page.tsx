import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, CalendarDays, Globe2, MapPin, Newspaper, Sparkles } from 'lucide-react';
import ScrollAnimation from '@/components/ScrollAnimation';
import { getDanceCircleArticles } from '@/lib/dance-circle';
import { buildShareMetadata } from '@/lib/share-metadata';

export const dynamic = 'force-dynamic';

export const metadata = buildShareMetadata({
  title: '东方舞圈｜全球东方舞新闻与报道',
  shareTitle: '东方舞圈',
  description: '聚合全球东方舞资讯、赛事报道、课程纪实、品牌动态和舞者故事。',
  path: '/dance-circle',
});

const categoryStyles: Record<string, string> = {
  '全球舞讯': 'bg-[#173B57] text-white',
  '赛事报道': 'bg-crimson text-white',
  '课程纪实': 'bg-[#8B6A32] text-white',
  '品牌动态': 'bg-[#2C1810] text-white',
  '人物故事': 'bg-[#6E405B] text-white',
  '东方舞人物志': 'bg-[#6E405B] text-white',
};
const ARTICLES_PER_PAGE = 12;

export default async function DanceCirclePage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string }>;
}) {
  const allArticles = getDanceCircleArticles();
  const featured = allArticles[0];
  const articles = allArticles.filter((article) => article.slug !== featured.slug);
  const requestedPage = Number((await searchParams)?.page || 1);
  const totalPages = Math.max(1, Math.ceil(articles.length / ARTICLES_PER_PAGE));
  const currentPage = Number.isInteger(requestedPage)
    ? Math.min(Math.max(requestedPage, 1), totalPages)
    : 1;
  const pagedArticles = articles.slice(
    (currentPage - 1) * ARTICLES_PER_PAGE,
    currentPage * ARTICLES_PER_PAGE,
  );

  return (
    <div className="min-h-screen bg-[#F8F3EA]">
      <section className="relative overflow-hidden bg-[#121D35] px-4 pb-14 pt-24 text-white md:pb-20 md:pt-32">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full border border-gold/15" />
        <div className="absolute -right-10 top-10 h-52 w-52 rounded-full border border-gold/10" />
        <div className="relative mx-auto max-w-7xl">
          <ScrollAnimation>
            <div className="flex items-center gap-2 text-sm font-semibold tracking-[0.22em] text-[#E2C680]">
              <Globe2 className="h-4 w-4" /> DANCE CIRCLE
            </div>
            <div className="mt-5">
              <h1 className="font-serif text-4xl font-bold md:text-6xl">东方舞圈</h1>
              <p className="mt-4 max-w-2xl text-base leading-8 text-white/70 md:text-lg">
                聚合全球东方舞消息，记录赛场、课堂与舞者，用中文新闻稿和深度报道连接更广阔的舞蹈世界。
              </p>
            </div>
          </ScrollAnimation>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 md:py-16 lg:px-8">
        <ScrollAnimation>
          <article className="group grid overflow-hidden rounded-2xl border border-[#E5D7C1] bg-white shadow-[0_18px_55px_rgba(76,47,27,0.09)] lg:grid-cols-[1.1fr_0.9fr]">
            <Link href={featured.canonicalPath || `/dance-circle/${featured.slug}`} className="relative min-h-64 overflow-hidden lg:min-h-[430px]">
              <Image src={featured.image} alt={featured.title} fill priority sizes="(min-width: 1024px) 55vw, 100vw" className="object-cover transition duration-700 group-hover:scale-[1.03]" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
              <span className="absolute left-5 top-5 inline-flex items-center gap-1.5 rounded-full bg-[#E2C680] px-3 py-1.5 text-xs font-bold text-[#2C1810]">
                <Sparkles className="h-3.5 w-3.5" /> 最新发布
              </span>
            </Link>
            <div className="flex flex-col justify-center p-6 md:p-10">
              <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${categoryStyles[featured.category]}`}>{featured.category}</span>
              <h2 className="mt-5 font-serif text-2xl font-bold leading-snug text-[#2C1810] md:text-4xl">{featured.title}</h2>
              <p className="mt-4 text-sm leading-7 text-[#746454] md:text-base">{featured.summary}</p>
              <div className="mt-6 flex flex-wrap gap-4 text-xs text-[#9A8875]">
                <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />{featured.date}</span>
                {featured.location ? <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" />{featured.location}</span> : null}
              </div>
              <Link href={featured.canonicalPath || `/dance-circle/${featured.slug}`} className="mt-8 inline-flex items-center gap-2 font-semibold text-crimson">阅读全文 <ArrowRight className="h-4 w-4" /></Link>
            </div>
          </article>
        </ScrollAnimation>

        <div className="mb-6 mt-14 flex items-end justify-between md:mt-20">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold tracking-[0.2em] text-[#A98746]"><Newspaper className="h-4 w-4" />LATEST STORIES</div>
            <h2 className="mt-2 font-serif text-3xl font-bold text-[#2C1810]">最新报道</h2>
          </div>
          <span className="text-sm text-[#8D7A66]">共 {allArticles.length} 篇</span>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {pagedArticles.map((article, index) => (
            <ScrollAnimation key={article.slug} delay={Math.min(index * 70, 210)}>
              <article className="group h-full overflow-hidden rounded-xl border border-[#E5D7C1] bg-white transition duration-300 hover:-translate-y-1 hover:shadow-xl">
                <Link href={article.canonicalPath || `/dance-circle/${article.slug}`}>
                  <div className="relative aspect-[16/10] overflow-hidden bg-[#E8DDCB]">
                    <Image src={article.image} alt={article.title} fill sizes="(min-width: 1280px) 31vw, (min-width: 768px) 48vw, 100vw" className="object-cover transition duration-500 group-hover:scale-105" />
                  </div>
                  <div className="p-5">
                    <div className="flex items-center justify-between gap-3">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${categoryStyles[article.category]}`}>{article.category}</span>
                      <span className="text-xs text-[#9A8875]">{article.date}</span>
                    </div>
                    <h3 className="mt-4 line-clamp-2 font-serif text-xl font-bold leading-snug text-[#2C1810] transition-colors group-hover:text-crimson">{article.title}</h3>
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#746454]">{article.summary}</p>
                    <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#9F1D20]">阅读全文 <ArrowRight className="h-4 w-4" /></span>
                  </div>
                </Link>
              </article>
            </ScrollAnimation>
          ))}
        </div>
        {totalPages > 1 ? (
          <nav className="mt-10 flex items-center justify-center gap-3" aria-label="报道分页">
            {currentPage > 1 ? (
              <Link className="rounded-md border border-[#E1D2BC] bg-white px-4 py-2 text-sm font-semibold text-[#6B5847]" href={`/dance-circle?page=${currentPage - 1}`}>
                上一页
              </Link>
            ) : null}
            <span className="text-sm text-[#8D7A66]">第 {currentPage} / {totalPages} 页</span>
            {currentPage < totalPages ? (
              <Link className="rounded-md bg-crimson px-4 py-2 text-sm font-semibold text-white" href={`/dance-circle?page=${currentPage + 1}`}>
                下一页
              </Link>
            ) : null}
          </nav>
        ) : null}
      </main>
    </div>
  );
}
