export type SiteSearchKind =
  | 'page'
  | 'online-course'
  | 'offline-course'
  | 'lesson'
  | 'news'
  | 'event'
  | 'teacher';

export type SiteSearchCandidate = {
  id: string;
  kind: SiteSearchKind;
  title: string;
  description: string;
  href: string;
  keywords?: string;
  date?: string;
};

export type SiteSearchResult = Omit<SiteSearchCandidate, 'keywords' | 'date'> & {
  score: number;
};

const MAX_QUERY_LENGTH = 50;

export function normalizeSearchText(value: unknown) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('zh-CN');
}

export function normalizeSearchQuery(value: unknown) {
  return normalizeSearchText(value).slice(0, MAX_QUERY_LENGTH);
}

function compact(value: string) {
  return value.replace(/[\s"'“”‘’《》（）()【】[\]：:，,。！!、·•・.\-—_]/g, '');
}

function scoreField(field: string, query: string, exact: number, prefix: number, contains: number) {
  if (!field) return 0;
  if (field === query) return exact;
  if (field.startsWith(query)) return prefix;
  if (field.includes(query)) return contains;
  return 0;
}

export function scoreSearchCandidate(candidate: SiteSearchCandidate, rawQuery: string) {
  const query = normalizeSearchQuery(rawQuery);
  if (!query) return 0;

  const title = normalizeSearchText(candidate.title);
  const description = normalizeSearchText(candidate.description);
  const keywords = normalizeSearchText(candidate.keywords);
  const compactQuery = compact(query);
  const compactTitle = compact(title);
  const compactDescription = compact(description);
  const compactKeywords = compact(keywords);
  const tokens = query.split(' ').filter(Boolean);

  let score = scoreField(title, query, 120, 90, 70);
  score = Math.max(score, scoreField(compactTitle, compactQuery, 118, 88, 68));
  score = Math.max(score, scoreField(description, query, 55, 42, 30));
  score = Math.max(score, scoreField(compactDescription, compactQuery, 53, 40, 28));
  score = Math.max(score, scoreField(keywords, query, 48, 36, 24));
  score = Math.max(score, scoreField(compactKeywords, compactQuery, 46, 34, 22));

  if (tokens.length > 1) {
    const haystack = `${title} ${description} ${keywords}`;
    if (tokens.every((token) => haystack.includes(token))) score += 18;
  }

  const kindBoost: Record<SiteSearchKind, number> = {
    'online-course': 9,
    'offline-course': 8,
    lesson: 6,
    news: 5,
    event: 5,
    teacher: 4,
    page: 3,
  };
  return score > 0 ? score + kindBoost[candidate.kind] : 0;
}

export function rankSearchResults(
  candidates: SiteSearchCandidate[],
  query: string,
  limit = 50,
): SiteSearchResult[] {
  const bestByTarget = new Map<string, SiteSearchCandidate & { score: number }>();

  for (const candidate of candidates) {
    const score = scoreSearchCandidate(candidate, query);
    if (!score) continue;
    const result = { ...candidate, score };
    const dedupeKey = `${candidate.kind}:${candidate.href}:${compact(normalizeSearchText(candidate.title))}`;
    const previous = bestByTarget.get(dedupeKey);
    if (!previous || result.score > previous.score) bestByTarget.set(dedupeKey, result);
  }

  return [...bestByTarget.values()]
    .sort((a, b) =>
      b.score - a.score
      || String(b.date || '').localeCompare(String(a.date || ''))
      || a.title.localeCompare(b.title, 'zh-CN'))
    .slice(0, Math.max(1, Math.min(100, limit)))
    .map(({ keywords: _keywords, date: _date, ...result }) => result);
}
