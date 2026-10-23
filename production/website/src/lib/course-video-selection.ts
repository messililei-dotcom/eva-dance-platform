export type SelectableCourseVideo = {
  id: string | number;
  material_id?: string | number;
};

/**
 * Current catalogue links carry CourseVideo.id. Older shared links may still
 * carry Material.id, so keep that compatibility without allowing an earlier
 * material-ID collision to shadow an exact video-ID match.
 */
export function findCourseVideoSelection<T extends SelectableCourseVideo>(
  videos: readonly T[],
  selectedId: string,
): T | null {
  if (!selectedId) return null;
  return videos.find(video => String(video.id) === selectedId)
    || videos.find(video => String(video.material_id || '') === selectedId)
    || null;
}
