import type { Metadata } from 'next';
import { buildShareMetadata } from '@/lib/share-metadata';

export const metadata: Metadata = buildShareMetadata({
  title: '线下培训',
  description: '伊娃东方舞线下培训课程、集训营与师资认证课程。',
  path: '/offline',
  image: '/images/courses/swod-coach-class.jpg',
});

export default function OfflineLayout({ children }: { children: React.ReactNode }) {
  return children;
}

