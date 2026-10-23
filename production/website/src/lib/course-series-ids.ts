export type LegacyCourseSeriesMapping = {
  legacyCourseId: string;
  platformSeriesId: number | null;
};

/**
 * The 21 historic website video-entry IDs.
 *
 * A null platformSeriesId is intentional: the legacy course has not been
 * matched to a series in the unified platform yet. Keeping that distinction
 * prevents a colliding numeric ID from opening an unrelated platform course.
 */
export const LEGACY_COURSE_SERIES_MAPPINGS: readonly LegacyCourseSeriesMapping[] = [
  { legacyCourseId: '1', platformSeriesId: 1 },
  { legacyCourseId: '2', platformSeriesId: 10 },
  { legacyCourseId: '3', platformSeriesId: 3 },
  { legacyCourseId: '4', platformSeriesId: 4 },
  { legacyCourseId: '5', platformSeriesId: 5 },
  { legacyCourseId: '6', platformSeriesId: 6 },
  { legacyCourseId: '7', platformSeriesId: 12 },
  { legacyCourseId: '8', platformSeriesId: 7 },
  { legacyCourseId: '9', platformSeriesId: 14 },
  { legacyCourseId: '10', platformSeriesId: 8 },
  { legacyCourseId: '11', platformSeriesId: 15 },
  { legacyCourseId: '12', platformSeriesId: 16 },
  { legacyCourseId: '13', platformSeriesId: 17 },
  { legacyCourseId: '14', platformSeriesId: 18 },
  { legacyCourseId: '15', platformSeriesId: 19 },
  { legacyCourseId: '16', platformSeriesId: null },
  { legacyCourseId: '17', platformSeriesId: null },
  { legacyCourseId: 'D1', platformSeriesId: null },
  { legacyCourseId: 'D2', platformSeriesId: 26 },
  { legacyCourseId: 'D3', platformSeriesId: 23 },
  { legacyCourseId: 'D4', platformSeriesId: 21 },
] as const;

const legacySeriesMap = new Map(
  LEGACY_COURSE_SERIES_MAPPINGS.map((item) => [item.legacyCourseId, item.platformSeriesId]),
);

export function hasLegacyCourseEntry(courseId: string | number): boolean {
  return legacySeriesMap.has(String(courseId));
}

export function getPlatformSeriesIdForLegacyCourse(courseId: string | number): number | null | undefined {
  return legacySeriesMap.get(String(courseId));
}

export function getCourseVideoHref(input: {
  courseId: string | number;
  legacyCourseId?: string | number | null;
  platformSeriesId?: string | number | null;
  videoId?: string | number | null;
}): string {
  const legacyCourseId = String(input.legacyCourseId ?? input.courseId);
  const explicitPlatformId = Number(input.platformSeriesId);
  const mappedPlatformId = getPlatformSeriesIdForLegacyCourse(legacyCourseId);
  const platformSeriesId = Number.isInteger(explicitPlatformId) && explicitPlatformId > 0
    ? explicitPlatformId
    : mappedPlatformId;
  const routeId = platformSeriesId ?? input.courseId;
  const query = new URLSearchParams();

  if (platformSeriesId !== null && platformSeriesId !== undefined) {
    query.set('source', 'platform');
  }
  if (input.videoId !== null && input.videoId !== undefined && String(input.videoId)) {
    query.set('video', String(input.videoId));
  }

  const queryString = query.toString();
  return `/courses/${encodeURIComponent(String(routeId))}/videos${queryString ? `?${queryString}` : ''}`;
}

