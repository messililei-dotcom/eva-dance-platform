export type AdminIdentity = { username?: string; role?: string; status?: string } | null | undefined;

export const SUPER_ADMIN_PAGES = [
  '/dashboard', '/student-growth', '/access-records', '/online-course/materials',
  '/certificates', '/permissions', '/settings',
] as const;

function canonicalPath(path: string) {
  let value = path.split('?')[0];
  try { value = decodeURIComponent(value); } catch { /* Invalid URLs will not match a route. */ }
  return value.replace(/^\/(?:local-api|legacy-student-api)(?=\/)/, '/api').replace(/\/+$/, '') || '/';
}
function within(path: string, root: string) { return path === root || path.startsWith(`${root}/`); }

// The existing permanent super administrator uses role "admin"; ordinary admins
// have the same role string, so that role alone cannot grant these features.
export function isPlatformSuperAdmin(user: AdminIdentity) {
  return Boolean(user && (!user.status || user.status === 'active') &&
    (user.username === 'lilei' || user.role === 'super_admin'));
}
export function canAccessEvents(user: AdminIdentity) {
  return isPlatformSuperAdmin(user) || Boolean(user && (!user.status || user.status === 'active') && user.role === 'event_admin');
}
export function adminLandingPage(user: AdminIdentity) {
  if (isPlatformSuperAdmin(user)) return '/dashboard';
  return user?.role === 'event_admin' ? '/events' : '/online-course/auth';
}
export function isRestrictedAdminPage(path: string) {
  const value = canonicalPath(path);
  return SUPER_ADMIN_PAGES.some(root => within(value, root)) || within(value, '/events');
}
export function isRemovedAdminPage(path: string) {
  return within(canonicalPath(path), '/live');
}
export function canAccessAdminPage(user: AdminIdentity, path: string) {
  if (!user || (user.status && user.status !== 'active')) return false;
  const value = canonicalPath(path);
  if (isRemovedAdminPage(value)) return false;
  if (within(value, '/events')) return canAccessEvents(user);
  if (user.role === 'event_admin') return false;
  if (SUPER_ADMIN_PAGES.some(root => within(value, root))) return isPlatformSuperAdmin(user);
  return true;
}

export function adminApiFeature(path: string, method: string): 'super_admin' | 'events' | null {
  const value = canonicalPath(path);
  if (within(value, '/api/event')) return 'events';
  if (['/api/dashboard', '/api/student-growth', '/api/users'].some(root => within(value, root))) return 'super_admin';
  // All staff continue recording their own navigation/operation audits.
  if (within(value, '/api/access-records') && method.toUpperCase() !== 'POST') return 'super_admin';
  if (within(value, '/api/certificates') && value !== '/api/certificates/verify') return 'super_admin';
  // Course-bound preview media are used by ordinary teaching workflows too.
  const preview = /^(?:GET|HEAD)$/i.test(method) && /^\/api\/course\/materials\/\d+\/(?:file|thumbnail)$/.test(value);
  if (!preview && ['/api/course/materials', '/api/course/material-folders'].some(root => within(value, root))) return 'super_admin';
  return null;
}
export function canAccessAdminApi(user: AdminIdentity, path: string, method: string) {
  if (!user || (user.status && user.status !== 'active')) return false;
  const feature = adminApiFeature(path, method);
  return feature === 'super_admin' ? isPlatformSuperAdmin(user) : feature === 'events' ? canAccessEvents(user) : true;
}
