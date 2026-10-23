import { redirect } from 'next/navigation';
import { offlineEntryUrl, parseOfflineEntry } from '@/lib/offline-entry';
export default async function OfflineSchedulePage({ searchParams }: {searchParams: Promise<Record<string,string|string[]|undefined>>}) {
  const query = await searchParams;
  const params = new URLSearchParams();
  params.set('tab', typeof query.tab==='string'?query.tab:'bookings');
  if(typeof query.course_ids==='string') params.set('course_ids',query.course_ids);
  redirect(offlineEntryUrl(parseOfflineEntry(params.toString())));
}
