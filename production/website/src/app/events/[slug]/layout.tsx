import type { Metadata } from 'next';
import { eventShareMetadata } from '@/lib/event-share-metadata';

type Props = {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return eventShareMetadata((await params).slug);
}

export default function EventDetailLayout({ children }: Props) {
  return children;
}
