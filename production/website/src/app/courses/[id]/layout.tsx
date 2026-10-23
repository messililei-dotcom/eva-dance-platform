import type { Metadata } from 'next';
import { buildShareMetadata, courseShareDescription, findShareCourse } from '@/lib/share-metadata';

type Props = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const course = findShareCourse(id);

  return buildShareMetadata({
    title: course?.title || '课程详情',
    description: courseShareDescription(course),
    path: `/courses/${encodeURIComponent(id)}${course?.platformSeriesId ? "?source=platform" : ""}`,
    image: course?.image,
    type: 'article',
  });
}

export default function CourseDetailLayout({ children }: Props) {
  return children;
}

