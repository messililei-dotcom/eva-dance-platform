function findCourseVideoSelection(videos, selectedId) {
  const target = String(selectedId || "");
  if (!target) return null;
  return (videos || []).find(video => String(video.videoId || video.id || "") === target)
    || (videos || []).find(video => String(video.materialId || video.material_id || "") === target)
    || null;
}

module.exports = { findCourseVideoSelection };
