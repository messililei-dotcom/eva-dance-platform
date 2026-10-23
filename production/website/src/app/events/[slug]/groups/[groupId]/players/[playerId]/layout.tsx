import type { Metadata } from 'next';
import { eventPlayerShareMetadata } from '@/lib/event-share-metadata';

type Props = {
  children: React.ReactNode;
  params: Promise<{ slug: string; groupId: string; playerId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, groupId, playerId } = await params;
  return eventPlayerShareMetadata(slug, groupId, playerId);
}

export default function EventPlayerLayout({ children }: Props) {
  return children;
}
