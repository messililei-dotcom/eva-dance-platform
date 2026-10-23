import type { Metadata } from 'next';
import { buildShareMetadata } from '@/lib/share-metadata';

export const metadata: Metadata = buildShareMetadata({
  title: '门徒与认证教师',
  description: '伊娃东方舞门徒和认证教师展示。',
  path: '/disciples',
});

export default function DisciplesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
