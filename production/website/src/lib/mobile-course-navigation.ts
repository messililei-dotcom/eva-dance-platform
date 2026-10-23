const COURSE_INTRO_PATH = /^\/courses\/([^/]+)\/?$/;

/**
 * iPadOS 13+ can identify itself as macOS, but its Safari user agent still
 * contains the `Mobile/... Safari/...` markers. Keep that case alongside the
 * conventional phone and tablet identifiers.
 */
export function isMobileOrTabletUserAgent(userAgent: string): boolean {
  return /(?:Android|iPhone|iPod|iPad|Mobile)/i.test(userAgent);
}

export function getMobileCourseVideoPath(pathname: string, userAgent: string): string | null {
  if (!isMobileOrTabletUserAgent(userAgent)) return null;

  const match = pathname.match(COURSE_INTRO_PATH);
  if (!match) return null;

  return `/courses/${match[1]}/videos`;
}
