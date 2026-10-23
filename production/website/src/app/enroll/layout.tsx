import type { Metadata } from 'next';
import { buildShareMetadata } from '@/lib/share-metadata';

export const metadata: Metadata = buildShareMetadata({
  title: '免费咨询报名',
  description: '免费咨询伊娃东方舞线下课程、集训和师资培训。',
  path: '/enroll',
});

export default function EnrollLayout({ children }: { children: React.ReactNode }) {
  return children;
}
