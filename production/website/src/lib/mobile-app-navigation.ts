export type MobileTab = 'academy' | 'offline' | 'events' | 'shop' | 'profile';
export function activeMobileTab(path: string): MobileTab | null {
  if (path === '/dashboard/events' || path.startsWith('/dashboard/events/')) return 'profile';
  if (path === '/' || path === '/courses' || path.startsWith('/courses/') || path.startsWith('/dance-collection')) return 'academy';
  if (path === '/offline' || path.startsWith('/offline/') || path === '/training-calendar') return 'offline';
  if (path === '/events' || path.startsWith('/events/') || path.startsWith('/events-news')) return 'events';
  if (path === '/shop' || path.startsWith('/shop/')) return 'shop';
  if (path === '/dashboard' || path.startsWith('/dashboard/') || ['/profile','/my-courses','/login','/register'].includes(path)) return 'profile';
  return null;
}
