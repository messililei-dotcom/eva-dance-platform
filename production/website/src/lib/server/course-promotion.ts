/** Shared public pricing policy. Stored course prices are never overwritten by a toggle. */
export function getCoursePromotion(db: any): { enabled: boolean; revision: string; updatedAt: string } {
  if (!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='CourseSalesConfig'").get()) return { enabled: false, revision: '', updatedAt: '' };
  const row = db.prepare('SELECT value, revision, updated_at FROM CourseSalesConfig WHERE key=?').get('promotionEnabled');
  return { enabled: row?.value === 'true', revision: row?.revision || '', updatedAt: row?.updated_at || '' };
}
export function applyCoursePromotion<T extends { promo_price?: unknown; is_free?: unknown }>(course: T, enabled: boolean): T & { promo_price: number; promotion_enabled: boolean } {
  const promo = Number(course.promo_price);
  const free = course.is_free === true || Number(course.is_free) === 1;
  return { ...course, promo_price: enabled && !free && Number.isFinite(promo) && promo > 0 ? promo : 0, promotion_enabled: enabled };
}
export function courseSalePrice(course: { price?: unknown; promo_price?: unknown; is_free?: unknown }, enabled: boolean): number {
  if (course.is_free === true || Number(course.is_free) === 1) return 0;
  const row = applyCoursePromotion(course, enabled);
  const price = Number(row.promo_price || course.price || 0);
  return Number.isFinite(price) && price > 0 ? price : 0;
}
