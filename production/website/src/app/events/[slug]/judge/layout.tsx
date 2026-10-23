import type { Metadata } from 'next';
import { eventOperationMetadata } from '@/lib/event-share-metadata';

type Props = { children: React.ReactNode; params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return eventOperationMetadata(slug, '赛事评委评分');
}

export default function EventJudgeLayout({ children }: Props) {
  return children;
}
