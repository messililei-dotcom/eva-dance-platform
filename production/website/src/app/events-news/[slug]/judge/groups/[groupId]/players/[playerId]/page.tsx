import JudgeScoreClient from '@/components/events/JudgeScoreClient';
import { JudgePage } from '@/components/events/JudgePresentation';

export const dynamic = 'force-dynamic';

export default async function JudgePlayerPage({ params }: { params: Promise<{ slug: string; groupId: string; playerId: string }> }) {
  const { slug, groupId, playerId } = await params;
  return <JudgePage title="选手评分" backHref={`/events/${slug}/judge/groups/${groupId}`} backLabel="返回选手列表">
    <JudgeScoreClient slug={slug} groupId={groupId} playerId={playerId} />
  </JudgePage>;
}
