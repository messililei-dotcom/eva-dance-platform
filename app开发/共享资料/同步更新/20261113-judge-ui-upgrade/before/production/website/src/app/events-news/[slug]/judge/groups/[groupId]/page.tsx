import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import JudgePlayersClient from '@/components/events/JudgePlayersClient';

export const dynamic = 'force-dynamic';

export default async function JudgeGroupPage({ params }: { params: Promise<{ slug: string; groupId: string }> }) {
  const { slug, groupId } = await params;
  return <div className="min-h-screen bg-warm-white pb-16 pt-20 md:pt-28"><div className="mx-auto max-w-3xl px-4 sm:px-6">
    <Link href={`/events/${slug}/judge`} className="mb-4 inline-flex items-center gap-2 text-sm text-text-muted"><ArrowLeft className="h-4 w-4" />返回评分组别</Link>
    <JudgePlayersClient slug={slug} groupId={groupId} />
  </div></div>;
}
