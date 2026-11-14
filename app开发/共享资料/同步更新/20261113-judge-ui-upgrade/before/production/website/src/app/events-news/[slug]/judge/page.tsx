import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import JudgeGroupsClient from '@/components/events/JudgeGroupsClient';
import { getEventCompetitionId, getEventNewsBySlug } from '@/lib/events-news';

export const dynamic = 'force-dynamic';

export default async function JudgeHomePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = getEventNewsBySlug(slug);
  if (!event || !getEventCompetitionId(event)) notFound();
  return <div className="min-h-screen bg-warm-white pb-16 pt-20 md:pt-28"><div className="mx-auto max-w-3xl px-4 sm:px-6">
    <Link href={`/events/${slug}`} className="mb-4 inline-flex items-center gap-2 text-sm text-text-muted"><ArrowLeft className="h-4 w-4" />返回赛事</Link>
    <div className="mb-5"><div className="text-xs font-semibold text-gold-dark">评委工作台</div><h1 className="mt-1 font-serif text-2xl font-bold text-text">{event.title}</h1></div>
    <JudgeGroupsClient slug={slug} />
  </div></div>;
}
