export function alignCourseLessonCountText(value: unknown, lessonCount: number): string {
  const text = String(value || '');
  if (!text || !Number.isInteger(lessonCount) || lessonCount < 0) return text;
  return text.replace(/(本课程共包含)\s*\d+\s*节/g, `$1${lessonCount}节`);
}
