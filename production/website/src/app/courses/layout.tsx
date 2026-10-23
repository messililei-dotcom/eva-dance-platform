import type { Metadata } from 'next';
import { buildShareMetadata } from '@/lib/share-metadata';

export const metadata: Metadata = buildShareMetadata({
  title: '线上学院',
  description: '伊娃东方舞线上学院，系统课程与成品舞课程学习入口。',
  path: '/courses',
  image: '/icons/icon-512-20261005.png',
});

export default function CoursesLayout({ children }: { children: React.ReactNode }) {
  return children;
}

