/** Official native clients are member/judge clients, never management clients. */
export function blocksNativeManagement(pathname: string, platform: string | null): boolean {
  if (!['ios', 'android', 'harmony'].includes((platform || '').trim().toLowerCase())) return false;
  const path = pathname.replace(/^\/(?:local-api|legacy-student-api)(?=\/)/, '/api');
  if (!path.startsWith('/api/')) return false;
  if (/^\/api\/(?:app|mini)(?:\/|$)/.test(path)) return false;
  if (path.startsWith('/api/public/')) return false;
  if (['/api/course/cover-image', '/api/courses/cover-image', '/api/certificates/verify'].includes(path)) return false;
  return true;
}
