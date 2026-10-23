import { Suspense } from 'react';
import { buildShareMetadata, findShareCourse } from '@/lib/share-metadata';
import { getPlatformSeriesIdForLegacyCourse } from '@/lib/course-series-ids';
import { courses } from '@/config/courses';
import VideoClient from './video-client';
export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
export async function generateMetadata({ params, searchParams }: Props) {
  const { id } = await params;
  const query = await searchParams;
  const seriesId = query.source === 'platform' ? Number(id) : getPlatformSeriesIdForLegacyCourse(id);
  const course = seriesId ? findShareCourse(String(seriesId)) : courses.find(c => c.id === id);
  return { ...buildShareMetadata({
    title: course?.title || '线上课程',
    description: course?.description || '查看课程介绍和完整目录，了解东方舞系统学习。',
    image: course?.image,
    path: seriesId ? `/courses/${seriesId}?source=platform` : `/courses/${encodeURIComponent(id)}`,
    type: 'article',
  }), robots: { index: false, follow: false, noarchive: true } };
}
export default function VideoPage() {
  return <Suspense fallback={<p className="p-20">正在加载课程…</p>}><VideoClient /></Suspense>;
}
