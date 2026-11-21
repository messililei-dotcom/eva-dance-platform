import { notFound } from 'next/navigation';
import JudgeGroupsClient from '@/components/events/JudgeGroupsClient';
import { JudgePage } from '@/components/events/JudgePresentation';
import { getEventCompetitionId, getEventNewsBySlug } from '@/lib/events-news';

export const dynamic = 'force-dynamic';

export default async function JudgeHomePage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ group?: string }>;
}) {
  const { slug } = await params;
  const { group } = await searchParams;
  const event = getEventNewsBySlug(slug);
  if (!event || !getEventCompetitionId(event)) notFound();
  return <JudgePage title="评委工作台" backHref={`/events/${slug}`} backLabel="返回赛事">
    <JudgeGroupsClient slug={slug} eventTitle={event.title} previousGroup={group} />
  </JudgePage>;
}
