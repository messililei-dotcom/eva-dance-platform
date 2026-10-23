import { NextRequest, NextResponse } from 'next/server';
import { getPlatformSeriesIdForLegacyCourse } from '@/lib/course-series-ids';
import { shouldUseLegacyProfile } from '@/lib/legacy-browser';
import { getMobileCourseVideoPath } from '@/lib/mobile-course-navigation';

const CANONICAL_HOST = 'www.swod.com.cn';
const ROOT_HOST = 'swod.com.cn';
const PRIVATE_PAGE_PREFIXES = [
  '/dashboard',
  '/profile',
  '/my-courses',
  '/login',
  '/register',
];
const CACHEABLE_PUBLIC_API_PREFIXES = [
  '/api/platform-courses',
  '/api/platform-offline-courses',
  '/api/public/courses',
  '/api/mini/public/',
  '/api/events-news/media/',
];
const CACHEABLE_PUBLIC_API_PATTERNS = [
  /^\/api\/learn\/series\/[^/]+\/courses(?:\.json)?\/?$/,
];

function isPrivatePage(pathname: string) {
  return PRIVATE_PAGE_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isCacheablePublicApi(pathname: string) {
  return CACHEABLE_PUBLIC_API_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(prefix))
    || CACHEABLE_PUBLIC_API_PATTERNS.some(pattern => pattern.test(pathname));
}

export function proxy(request: NextRequest) {
  const host = request.headers.get('host')?.split(':')[0]?.toLowerCase() || '';
  const { pathname } = request.nextUrl;

  if (pathname === '/_next/image') {
    const media = request.nextUrl.searchParams.get('url') || '';
    if (/^\/api\/events-news\/media\/[a-z0-9-]{1,100}$/i.test(media)) {
      const url = request.nextUrl.clone();
      url.pathname = media;
      url.search = '';
      return NextResponse.redirect(url, 307);
    }
    return NextResponse.next();
  }

  if (host === ROOT_HOST) {
    const url = request.nextUrl.clone();
    url.protocol = 'https';
    url.host = CANONICAL_HOST;
    url.port = '';
    return NextResponse.redirect(url, 308);
  }

  if (pathname === '/dashboard/profile' && shouldUseLegacyProfile(request.headers.get('user-agent') || '')) {
    const url = request.nextUrl.clone();
    url.pathname = '/compat/profile.html';
    url.search = '';
    const response = NextResponse.rewrite(url);
    response.headers.set('Cache-Control', 'private, no-store, max-age=0');
    response.headers.set('Vary', 'User-Agent');
    response.headers.set('X-Profile-Compatibility', 'legacy-ios');
    return response;
  }

  const legacyVideoMatch = pathname.match(/^\/courses\/([^/]+)\/videos\/?$/);
  if (legacyVideoMatch && shouldUseLegacyProfile(request.headers.get('user-agent') || '')) {
    const courseId = legacyVideoMatch[1];
    const mapped = request.nextUrl.searchParams.get('source') === 'platform'
      ? Number(courseId) : getPlatformSeriesIdForLegacyCourse(courseId);
    const seriesId = mapped === undefined ? Number(courseId) : mapped;
    const url = request.nextUrl.clone();
    url.pathname = '/compat/player-20260918.html';
    url.search = '';
    url.searchParams.set('series_id', String(seriesId || 0));
    const videoId = request.nextUrl.searchParams.get('video');
    if (videoId) url.searchParams.set('video', videoId);
    const response = NextResponse.redirect(url, 307);
    response.headers.set('Cache-Control', 'private, no-store, max-age=0');
    response.headers.set('Vary', 'User-Agent');
    return response;
  }

  const mobileCourseVideoPath = getMobileCourseVideoPath(
    pathname,
    request.headers.get('user-agent') || '',
  );
  if (mobileCourseVideoPath) {
    const url = request.nextUrl.clone();
    url.pathname = mobileCourseVideoPath;
    const response = NextResponse.redirect(url, 307);
    response.headers.set('Cache-Control', 'private, no-store, max-age=0');
    response.headers.set('Vary', 'User-Agent');
    return response;
  }

  const response = NextResponse.next();
  if (pathname.startsWith('/api/')) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    // Course sales settings must take effect on the next request, without a cached quote.
    if (pathname === '/api/events/search' || /^\/api\/platform-courses(?:\/|$)/.test(pathname) || /^\/api\/mini\/public\/(?:series|calendar)(?:\/|$)/.test(pathname)) {
      response.headers.set('Cache-Control', 'private, no-store, max-age=0');
    } else if (isCacheablePublicApi(pathname)) {
      response.headers.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=60');
    } else {
      response.headers.set('Cache-Control', 'private, no-store, no-cache, max-age=0, s-maxage=0');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
    }
  } else if (/^\/courses\/[^/]+\/videos(?:\/|$)/.test(pathname)) {
    // 学习页的 HTML 只是公共客户端外壳，个人进度和播放地址由禁止缓存的 API 另行读取。
    response.headers.set('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=60');
  } else if (pathname === '/events' || pathname.startsWith('/events/') || pathname === '/events-news' || pathname.startsWith('/events-news/') || pathname === '/api/events/search') {
    response.headers.set('Cache-Control', 'private, no-store, no-cache, max-age=0, s-maxage=0');
  } else if (isPrivatePage(pathname)) {
    response.headers.set('Cache-Control', 'private, no-store, no-cache, max-age=0, s-maxage=0');
  } else if (/^\/courses\/[^/]+\/?$/.test(pathname)) {
    response.headers.set('Cache-Control', 'private, no-store, max-age=0');
    response.headers.set('Vary', 'User-Agent');
  } else if (request.method === 'GET' || request.method === 'HEAD') {
    response.headers.set('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=60');
  }
  return response;
}

export const config = {
  matcher: [
    '/api/:path*',
    '/_next/image',
    '/((?!_next/static|_next/image|favicon.ico|favicon.png|apple-touch-icon.png|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|map|txt|xml|json|woff|woff2)$).*)',
  ],
};
