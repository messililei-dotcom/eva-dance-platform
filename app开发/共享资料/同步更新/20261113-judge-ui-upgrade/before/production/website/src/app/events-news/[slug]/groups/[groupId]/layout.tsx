import type { Metadata } from 'next';
import { eventGroupShareMetadata } from '@/lib/event-share-metadata';

type Props = {
  children: React.ReactNode;
  params: Promise<{ slug: string; groupId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, groupId } = await params;
  return eventGroupShareMetadata(slug, groupId);
}

export default function LegacyEventGroupLayout({ children }: Props) {
  return children;
}
