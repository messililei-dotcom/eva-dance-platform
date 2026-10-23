import { notFound, redirect } from 'next/navigation';

export default async function LegacyOfflineCourseReportPage({ params }: {
  params: Promise<{ id: string; slug: string }>;
}) {
  const { id, slug } = await params;
  if (id !== '123' || slug !== 'alida-2026-graduation') notFound();
  redirect('/dance-circle/alida-2026-graduation');
}
