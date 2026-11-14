import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import JudgeScoreClient from '@/components/events/JudgeScoreClient';

export const dynamic = 'force-dynamic';

export default async function JudgePlayerPage({ params }: { params: Promise<{ slug: string; groupId: string; playerId: string }> }) {
  const { slug, groupId, playerId } = await params;
  return <div className="min-h-screen bg-warm-white pb-16 pt-20 md:pt-28"><div className="mx-auto max-w-2xl px-4 sm:px-6">
    <Link href={`/events/${slug}/judge/groups/${groupId}`} className="mb-4 inline-flex items-center gap-2 text-sm text-text-muted"><ArrowLeft className="h-4 w-4" />返回选手列表</Link>
    <JudgeScoreClient slug={slug} groupId={groupId} playerId={playerId} />
  </div></div>;
}
