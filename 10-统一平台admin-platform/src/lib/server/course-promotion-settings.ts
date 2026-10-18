import { randomUUID } from 'node:crypto';
import { getCoursePromotion } from './course-promotion';
export class PromotionConflict extends Error {}
export function setCoursePromotion(db: any, enabled: boolean, expectedRevision: string) {
  db.exec(`CREATE TABLE IF NOT EXISTS CourseSalesConfig (
    key TEXT PRIMARY KEY, value TEXT NOT NULL, revision TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT ''
  )`);
  db.prepare("INSERT OR IGNORE INTO CourseSalesConfig(key,value) VALUES('promotionEnabled','false')").run();
  const changed = db.prepare('UPDATE CourseSalesConfig SET value=?, revision=?, updated_at=? WHERE key=? AND revision=?')
    .run(String(enabled), randomUUID(), new Date().toISOString(), 'promotionEnabled', expectedRevision);
  if (Number(changed.changes) !== 1) throw new PromotionConflict('促销设置已被其他管理员修改，请刷新后重试');
  return getCoursePromotion(db);
}
