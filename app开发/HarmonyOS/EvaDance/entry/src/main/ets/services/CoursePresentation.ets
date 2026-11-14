import { Row } from './Models';
import { offlineAliases, offlineCopies, OfflineCopy } from './OfficialOfflineCopy';
export function coursePrice(row: Row): string {
  if (row.period_status === undefined && (row.is_free === true || row.is_free === 1)) return '免费';
  const price = Number(row.promo_price || 0) > 0 ? Number(row.promo_price) : Number(row.price || 0);
  return Number.isFinite(price) && price > 0 ? '¥' + price.toFixed(2) : '咨询价格';
}
export function originalPrice(row: Row): string {
  return row.is_free !== true && row.is_free !== 1 && Number(row.promo_price || 0) > 0 && Number(row.price) > Number(row.promo_price) ? '原价 ¥' + Number(row.price).toFixed(2) : '';
}
export function offlineCopy(row: Row): OfflineCopy | undefined {
  const exact = offlineCopies.find((entry: OfflineCopy) => entry.period && entry.id === String(row.source_id));
  const alias = offlineAliases.find((entry) => entry.key === row.group_key);
  return exact || offlineCopies.find((entry: OfflineCopy) => !entry.period && entry.id === alias?.id);
}
export function offlineDescription(row: Row): string {
  return (offlineCopy(row)?.description || row.description || '').replace(/开课时间：[^｜\n]+/g, '开课时间：以所选期次安排为准');
}
export function canPurchasePeriod(row: Row, now: number = Date.now()): boolean {
  const today = new Date(now + 28800000).toISOString().slice(0, 10);
  return ['active', 'planned'].includes(row.period_status || '') && Number(row.source_id) > 0 && Number(row.price) > 0 && (!row.end_date || row.end_date.slice(0, 10) >= today) && (!(Number(row.capacity) > 0) || Number(row.remaining) > 0);
}
export function offlineCourseKey(row: Row): string { return (row.group_key || row.name || '').trim().replace(/\s+/g, ' ').toLowerCase(); }
function offlineYear(row: Row): number { const years = [row.start_date, row.end_date, row.subtitle].join(' ').match(/20[0-9]{2}/g) || []; return years.length ? Math.max(...years.map((year: string) => Number(year))) : 0; }
export function offlinePeriods(rows: Row[], course: Row): Row[] {
  return rows.filter((row: Row) => offlineCourseKey(row) === offlineCourseKey(course)).sort((a: Row, b: Row) => {
    const year = offlineYear(b) - offlineYear(a); if (year) return year;
    const date = (b.start_date || b.end_date || '').trim().slice(0, 10).localeCompare((a.start_date || a.end_date || '').trim().slice(0, 10));
    return date || Number(b.id || 0) - Number(a.id || 0);
  });
}
export function offlinePeriodLabel(row: Row): string {
  const start = (row.start_date || '').trim().slice(0, 10), end = (row.end_date || '').trim().slice(0, 10);
  if (start) return start + (end && end !== start ? ' 至 ' + end : '');
  const subtitle = (row.subtitle || '').trim(); return subtitle && subtitle.toLowerCase() !== 'offline' ? subtitle : '期次待公布';
}
export function groupedCourses(rows: Row[]): Row[] {
  const keys: string[] = []; const result: Row[] = [];
  rows.forEach((row: Row) => {
    const key = offlineCourseKey(row); if (!key || keys.includes(key)) return; keys.push(key);
    const periods = offlinePeriods(rows, row); const first = periods[0];
    const prices = periods.map((item: Row) => Number(item.price || 0)).filter((price: number) => Number.isFinite(price) && price > 0);
    const group = JSON.parse(JSON.stringify(first)) as Row;
    group.cover_image = first.cover_image || periods.find((item: Row) => !!item.cover_image)?.cover_image || '';
    group.offline_period_count = periods.length; group.offline_latest_period = offlinePeriodLabel(first);
    group.offline_student_count = Math.max(...periods.map((item: Row) => Number(item.group_total_students ?? item.total_students ?? 0)));
    group.offline_min_price = prices.length ? Math.min(...prices) : 0;
    group.offline_search_text = periods.map((item: Row) => [item.name, item.subtitle, item.teacher, item.category, item.start_date, item.end_date].filter((text: string | undefined) => !!text).join(' ')).join(' ');
    result.push(group);
  });
  return result;
}
export function offlineGroupPrice(row: Row): string {
  const value = Number(row.offline_min_price || row.price || 0); if (!Number.isFinite(value) || value <= 0) return '咨询价格';
  return '¥' + value.toFixed(2).replace(/\.00$/, '').replace(/(\.\d*[1-9])0+$/, '$1') + (Number(row.offline_period_count) > 1 ? '起' : '');
}
export function catalogLessons(units: Row[], records: Row[]): Row[] {
  const result: Row[] = [];
  units.forEach((unit: Row) => (unit.videos || []).forEach((video: Row) => {
    const record = records.find((item: Row) => String(item.video_id) === String(video.id));
    const duration = Number(record?.duration || video.duration || 0);
    const percent = record ? record.completed === 1 ? 100 : duration > 0 ? Math.min(100, Math.floor(Number(record.progress || 0) / duration * 100)) : 0 : undefined;
    result.push({ id: video.id, name: video.name || unit.name, subtitle: unit.name, mediaKind: /\.(m4a|mp3|aac|wav|flac|ogg)$/i.test(video.name || '') || (video.name || '').startsWith('音频') ? 'audio' : 'video', duration: duration, ordinal: result.length + 1, percent: percent });
  }));
  return result;
}
export function startingLesson(lessons: Row[], records: Row[]): Row | undefined {
  const valid = lessons.filter((lesson: Row) => Number(lesson.id) > 0);
  let selected: Row | undefined = valid[0];
  let latest = '';
  records.forEach((record: Row) => {
    const lesson = valid.find((item: Row) => String(item.id) === String(record.video_id));
    const playedAt = (record.last_play_at || '').replace('T', ' ');
    if (lesson && playedAt && playedAt > latest) { latest = playedAt; selected = lesson; }
  });
  return selected;
}

// Shared public display count from the mini-program API, not simultaneous viewers.
export function learnerText(row: Row): string {
  const base = row.student_display_base; const students = row.total_students;
  if (base === undefined || students === undefined || !Number.isFinite(base) || base < 500 || base > 1000 || Math.floor(base) !== base || !Number.isFinite(students) || students < 0 || Math.floor(students) !== students) return '';
  return String(base + students) + '名学员';
}
