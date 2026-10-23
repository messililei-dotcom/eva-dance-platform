import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, CalendarDays, MapPin } from 'lucide-react';
import { buildShareMetadata } from '@/lib/share-metadata';
import { getDanceCircleArticle } from '@/lib/dance-circle';
import AlidaGraduationReport from '@/components/dance-circle/AlidaGraduationReport';

type Props = { params: Promise<{ slug: string }> };

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = getDanceCircleArticle((await params).slug);
  if (!article) return {};
  return {
    ...buildShareMetadata({
      title: article.title,
      description: article.summary,
      path: article.canonicalPath || `/dance-circle/${article.slug}`,
      image: article.image,
      type: 'article',
      publishedTime: article.date,
    }),
    ...(article.keywords ? { keywords: article.keywords } : {}),
  };
}

export default async function DanceCircleArticlePage({ params }: Props) {
  const article = getDanceCircleArticle((await params).slug);
  if (!article) notFound();

  return (
    <article className="min-h-screen bg-[#FBF7EF] pb-16 pt-20 md:pb-24 md:pt-28">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <Link href="/dance-circle" className="inline-flex items-center gap-2 text-sm font-semibold text-[#8B6A32] transition hover:text-crimson">
          <ArrowLeft className="h-4 w-4" /> 返回东方舞圈
        </Link>

        <header className="mt-7 text-center">
          <span className="inline-flex rounded-full bg-[#2C1810] px-3 py-1 text-xs font-semibold text-white">{article.category}</span>
          <h1 className="mx-auto mt-5 max-w-3xl font-serif text-3xl font-bold leading-tight text-[#2C1810] md:text-5xl">{article.title}</h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-[#746454]">{article.summary}</p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-4 text-xs text-[#9A8875]">
            <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />{article.date}</span>
            {article.location ? <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" />{article.location}</span> : null}
            <span>编辑：伊娃东方舞</span>
          </div>
        </header>

        <div className="relative mt-9 aspect-[16/9] overflow-hidden rounded-2xl bg-[#E8DDCB] shadow-lg md:mt-12">
          <Image src={article.image} alt={article.title} fill priority unoptimized sizes="(min-width: 896px) 896px, 100vw" className="object-cover" />
        </div>

        <div className="mx-auto mt-9 max-w-3xl md:mt-12">
          {article.sections.map((section, index) => (
            <section key={`${article.slug}-${index}`} className="mb-9">
              {section.heading ? <h2 className="mb-4 font-serif text-2xl font-bold text-[#2C1810]">{section.heading}</h2> : null}
              <div className="space-y-5 text-base leading-8 text-[#55483C]">
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
            </section>
          ))}
          {article.contentHtml ? (
            <div
              className="space-y-5 text-base leading-8 text-[#55483C] [&_a]:text-crimson [&_a]:underline [&_a]:underline-offset-4 [&_blockquote]:border-l-2 [&_blockquote]:border-[#C8A96E] [&_blockquote]:pl-4 [&_blockquote]:text-[#746454] [&_figcaption]:mt-2 [&_figcaption]:text-center [&_figcaption]:text-sm [&_figcaption]:text-[#8D7A66] [&_h2]:mb-4 [&_h2]:mt-9 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-[#2C1810] [&_h3]:mb-3 [&_h3]:mt-7 [&_h3]:font-serif [&_h3]:text-xl [&_h3]:font-bold [&_h3]:text-[#2C1810] [&_img]:mx-auto [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-xl [&_li]:mb-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-5 [&_ul]:list-disc [&_ul]:pl-6"
              dangerouslySetInnerHTML={{ __html: article.contentHtml }}
            />
          ) : null}
          {article.sourceNote ? (
            <p className="border-l-2 border-[#C8A96E] pl-4 text-sm leading-6 text-[#8D7A66]">
              来源说明：{article.sourceNote}
              {article.sourceHref ? (
                <>
                  {' '}
                  <a href={article.sourceHref} target="_blank" rel="noopener noreferrer" className="font-semibold text-crimson underline underline-offset-4">
                    查看公众号原文
                  </a>
                </>
              ) : null}
            </p>
          ) : null}
          {article.relatedHref ? (
            <Link href={article.relatedHref} className="mt-8 inline-flex items-center gap-2 rounded-full bg-crimson px-6 py-3 text-sm font-semibold text-white transition hover:bg-crimson-dark">
              {article.relatedLabel || '查看相关内容'} <ArrowRight className="h-4 w-4" />
            </Link>
          ) : null}
        </div>

        {article.slug === 'alida-2026-graduation' ? <AlidaGraduationReport /> : null}

        <div className="mt-12 border-t border-[#E5D7C1] pt-7 text-center">
          <Link href="/dance-circle" className="inline-flex items-center gap-2 rounded-full border border-[#B99652] bg-white px-6 py-3 text-sm font-semibold text-[#8B6A32] transition hover:bg-[#F2E6D3]">
            <ArrowLeft className="h-4 w-4" /> 查看更多报道
          </Link>
        </div>
      </div>
    </article>
  );
}
