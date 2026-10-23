import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, CalendarDays, Globe2, MapPin } from 'lucide-react';
import ScrollAnimation from '@/components/ScrollAnimation';
import SectionHeader from '@/components/SectionHeader';
import { danceCircleArticles } from '@/data/dance-circle';

export default function LatestNewsSection() {
  return (
    <section className="bg-gradient-to-b from-[#F4EDE2] to-white py-6 md:py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <ScrollAnimation>
          <SectionHeader
            number="08"
            icon={Globe2}
            badge="DANCE CIRCLE"
            title="东方舞圈"
            subtitle="聚合全球舞讯、赛事报道、课程纪实与舞者故事，在这里看见更广阔的东方舞世界"
          />
        </ScrollAnimation>

        <div className="grid gap-4 md:grid-cols-3 md:gap-5">
          {danceCircleArticles.map((article, index) => (
            <ScrollAnimation key={article.slug} delay={Math.min(index * 90, 180)}>
              <article className="group h-full overflow-hidden rounded-2xl border border-[#E4D7C3] bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl">
                <Link href={article.canonicalPath || `/dance-circle/${article.slug}`} className="flex h-full flex-col">
                  <div className="relative aspect-[16/10] overflow-hidden bg-[#E8DDCB]">
                    <Image
                      src={article.image}
                      alt={article.title}
                      fill
                      sizes="(min-width: 768px) 33vw, 100vw"
                      className="object-cover transition duration-500 group-hover:scale-105"
                    />
                    <span className="absolute left-4 top-4 rounded-full bg-[#201711]/85 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                      {article.category}
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col p-5 md:p-6">
                    <div className="flex flex-wrap gap-3 text-xs text-[#998775]">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5 text-[#B48A3A]" />
                        {article.date}
                      </span>
                      {article.location ? (
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-[#B48A3A]" />
                          {article.location}
                        </span>
                      ) : null}
                    </div>

                    <h3 className="mt-4 line-clamp-2 font-serif text-xl font-bold leading-snug text-[#2C1810] transition-colors group-hover:text-crimson md:text-2xl">
                      {article.title}
                    </h3>
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#746454]">
                      {article.summary}
                    </p>
                    <span className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-semibold text-crimson">
                      阅读全文 <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </span>
                  </div>
                </Link>
              </article>
            </ScrollAnimation>
          ))}
        </div>

        <ScrollAnimation delay={240}>
          <div className="mt-5 text-center md:mt-10">
            <Link
              href="/dance-circle"
              className="inline-flex items-center gap-2 rounded-full border-2 border-[#B99652] bg-white px-7 py-3 font-semibold text-[#8B6A32] transition hover:bg-[#B99652] hover:text-white"
            >
              进入东方舞圈
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </ScrollAnimation>
      </div>
    </section>
  );
}
