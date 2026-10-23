import type { Metadata } from 'next';
import { buildShareMetadata, findOfflineShareCourse } from '@/lib/share-metadata';

type Props = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const course = findOfflineShareCourse(id);

  return buildShareMetadata({
    title: course?.title || '线下培训课程',
    description: course?.description || '伊娃东方舞线下培训课程详情。',
    path: `/offline/${encodeURIComponent(id)}`,
    image: course?.image || '/images/courses/swod-coach-class.jpg',
    type: 'article',
  });
}

export default function OfflineCourseLayout({ children }: Props) {
  return children;
}
