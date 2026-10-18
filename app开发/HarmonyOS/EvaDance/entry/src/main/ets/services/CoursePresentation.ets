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
export function groupedCourses(rows: Row[]): Row[] {
  const seen: string[] = [];
  return rows.filter((row: Row) => { const key = row.group_key || row.name || ''; if (seen.includes(key)) return false; seen.push(key); return true; });
}
export function catalogLessons(units: Row[], records: Row[]): Row[] {
  const result: Row[] = [];
  units.forEach((unit: Row) => (unit.videos || []).forEach((video: Row) => {
    const record = records.find((item: Row) => String(item.video_id) === String(video.id));
    const duration = Number(record?.duration || video.duration || 0);
    const percent = record ? record.completed === 1 ? 100 : duration > 0 ? Math.min(100, Math.floor(Number(record.progress || 0) / duration * 100)) : 0 : undefined;
    result.push({ id: video.id, name: unit.name, duration: duration, ordinal: result.length + 1, percent: percent });
  }));
  return result;
}
