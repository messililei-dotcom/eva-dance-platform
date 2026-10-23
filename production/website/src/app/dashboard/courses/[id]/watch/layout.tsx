import type { Metadata } from 'next';
import { buildShareMetadata, courseShareDescription, findShareCourse } from '@/lib/share-metadata';

type Props = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const course = findShareCourse(id);
  const metadata = buildShareMetadata({
    title: course ? `${course.title} · 课程学习` : '课程学习',
    shareTitle: course?.title || '伊娃东方舞线上课程',
    description: courseShareDescription(course, '伊娃东方舞线上课程学习。'),
    path: course ? `/courses/${encodeURIComponent(id)}` : '/courses',
    image: course?.image,
    type: 'article',
  });
  return {
    ...metadata,
    robots: { index: false, follow: false, noarchive: true },
  };
}

export default function CourseWatchLayout({ children }: Props) {
  return children;
}
