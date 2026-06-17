export const PUBLIC_SHORT_CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
};

export function publicShortCacheJson(body: unknown, init?: ResponseInit) {
  return Response.json(body, {
    ...init,
    headers: {
      ...PUBLIC_SHORT_CACHE_HEADERS,
      ...(init?.headers || {}),
    },
  });
}
