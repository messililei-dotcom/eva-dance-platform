import type { Metadata } from 'next';
import { buildShareMetadata, findOfflineShareCourse } from '@/lib/share-metadata';

type Props = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const course = findOfflineShareCourse(id);
  const metadata = buildShareMetadata({
    title: course ? `${course.title} · 课程报名` : '课程报名',
    shareTitle: course?.title || '伊娃东方舞课程报名',
    description: course?.description || '报名伊娃东方舞线下集训和师资培训。',
    path: course ? `/offline/${encodeURIComponent(id)}` : '/offline',
    image: course?.image,
    type: 'article',
  });
  return {
    ...metadata,
    robots: { index: false, follow: false, noarchive: true },
  };
}

export default function EnrollDetailLayout({ children }: Props) {
  return children;
}
