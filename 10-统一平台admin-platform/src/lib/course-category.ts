export const COURSE_CATEGORY_ONLINE = '线上系统课';
export const COURSE_CATEGORY_DANCE = '成品舞';

export const COURSE_CATEGORY_OPTIONS = [
  { value: COURSE_CATEGORY_ONLINE, label: COURSE_CATEGORY_ONLINE },
  { value: COURSE_CATEGORY_DANCE, label: COURSE_CATEGORY_DANCE },
];

const DANCE_CATEGORY_PATTERN = /成品舞|经典|情感|国风|道具|民俗|现代融合|古典|作品/;
const ONLINE_CATEGORY_PATTERN = /线上系统课|线上学院|线上课|网课|视频课|录播|系统课/;

export function normalizeCourseCategory(value: unknown, fallbackContext: unknown = '') {
  const category = String(value || '').trim();
  if (category === COURSE_CATEGORY_ONLINE || category === COURSE_CATEGORY_DANCE) return category;
  const context = `${category} ${String(fallbackContext || '')}`;
  if (ONLINE_CATEGORY_PATTERN.test(context)) return COURSE_CATEGORY_ONLINE;
  if (DANCE_CATEGORY_PATTERN.test(context)) return COURSE_CATEGORY_DANCE;
  return COURSE_CATEGORY_ONLINE;
}

export function isOnlineCourseCategory(value: unknown) {
  return normalizeCourseCategory(value) === COURSE_CATEGORY_ONLINE;
}

export function isDanceCourseCategory(value: unknown) {
  return normalizeCourseCategory(value) === COURSE_CATEGORY_DANCE;
}
