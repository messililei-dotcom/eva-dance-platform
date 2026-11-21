import JudgePlayersClient from '@/components/events/JudgePlayersClient';
import { JudgePage } from '@/components/events/JudgePresentation';

export const dynamic = 'force-dynamic';

export default async function JudgeGroupPage({ params }: { params: Promise<{ slug: string; groupId: string }> }) {
  const { slug, groupId } = await params;
  return <JudgePage title="评委工作台" backHref={`/events/${slug}/judge?group=${groupId}`} backLabel="返回我的组别">
    <JudgePlayersClient slug={slug} groupId={groupId} />
  </JudgePage>;
}
