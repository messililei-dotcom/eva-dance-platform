import type { Course } from '@/config/courses';

export interface PublicCourseRecord {
  id: number | string;
  name?: string;
  displayName?: string;
  officialCourseName?: string;
  officialMatchKey?: string;
  type?: string;
  subType?: string;
  scheduleLabel?: string;
  startDate?: string;
  endDate?: string;
  price?: number;
  sessions?: number;
  teacher?: string;
  content?: string;
  status?: string;
  location?: string;
  capacity?: number;
  remaining?: number;
}

export function getPublicCourseName(course: PublicCourseRecord): string {
  return String(course.officialCourseName || course.displayName || course.name || '未知课程')
    .replace(/^扫码测试[-_：:\s]*/, '')
    .replace(/[-_]\d{10,}[-_]\d+$/, '')
    .trim();
}

export function normalizeCourseKey(value: string): string {
  return value
    .replace(/\([^)]*\)|（[^）]*）/g, '')
    .replace(/第[一二三四五六七八九十百\d]+[届期级]/g, '')
    .replace(/[^\u4e00-\u9fa5a-z0-9]/gi, '')
    .toLowerCase();
}

export function findBestCourseMatch(sourceName: string, courseList: Course[]): Course | undefined {
  const sourceKey = normalizeCourseKey(sourceName);
  if (!sourceKey) return undefined;

  const best = courseList
    .filter(course => course.category === 'offline')
    .map(course => {
      const titleKey = normalizeCourseKey(course.title);
      const descKey = normalizeCourseKey(`${course.title}${course.description}`);
      let score = 0;

      if (titleKey === sourceKey) score += 100;
      if (titleKey && sourceKey.includes(titleKey)) score += 70;
      if (sourceKey && titleKey.includes(sourceKey)) score += 60;

      for (const char of new Set(sourceKey.split(''))) {
        if (descKey.includes(char)) score += 1;
      }

      return { course, score };
    })
    .sort((a, b) => b.score - a.score)[0];

  return best && best.score >= 6 ? best.course : undefined;
}

export function courseRecordMatches(record: PublicCourseRecord, course: Course): boolean {
  const courseWithPlatformMatch = course as Course & {
    officialMatchKey?: string;
    legacyCourseId?: string;
  };
  const recordMatchKey = String(record.officialMatchKey || '').trim();
  const courseMatchKey = String(
    courseWithPlatformMatch.officialMatchKey || courseWithPlatformMatch.legacyCourseId || '',
  ).trim();
  if (recordMatchKey && courseMatchKey) return recordMatchKey === courseMatchKey;

  const recordKey = normalizeCourseKey(getPublicCourseName(record));
  const courseKey = normalizeCourseKey(course.title);
  if (!recordKey || !courseKey) return false;
  return recordKey === courseKey || recordKey.includes(courseKey) || courseKey.includes(recordKey);
}

export function getCourseStatus(record: PublicCourseRecord): 'ended' | 'open' {
  if (/^(inactive|ended|closed|cancelled|canceled|offline)$/i.test(String(record.status || ''))) {
    return 'ended';
  }
  const today = new Date().toISOString().split('T')[0];
  const hasValidEndDate = Boolean(
    record.endDate && (!record.startDate || record.endDate >= record.startDate),
  );
  return hasValidEndDate && record.endDate! < today ? 'ended' : 'open';
}
