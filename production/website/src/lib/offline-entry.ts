export type OfflineTab = 'courses' | 'consumes' | 'rights';
export function parseOfflineEntry(search: string): {tab: OfflineTab; courseIds: number[]} {
  const params = new URLSearchParams(search);
  const requested = params.get('tab') || 'courses';
  const raw = ['sessions','bookings'].includes(requested) ? 'rights' : requested;
  const tab = (['courses','consumes','rights'].includes(raw) ? raw : 'courses') as OfflineTab;
  const courseIds = [...new Set((params.get('course_ids') || '').split(',').map(Number).filter(id => Number.isSafeInteger(id) && id>0))].slice(0,200);
  return {tab,courseIds};
}
export function offlineEntryUrl(entry: {tab: OfflineTab; courseIds: number[]}) {
  const query = new URLSearchParams({tab:entry.tab});
  if(entry.courseIds.length) query.set('course_ids', entry.courseIds.join(','));
  return '/offline?' + query.toString();
}
