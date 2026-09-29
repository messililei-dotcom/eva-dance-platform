import { jsonError } from '../../_helpers';
import { openTrainingDb } from '../../../training-db';
import { noStoreJson } from '@/lib/http-cache';
import { miniOfflineCatalog } from '@/lib/server/mini-offline-catalog';

export const dynamic = 'force-dynamic';

// Use the same published titles, covers, teachers and period selection as the official website.
export async function GET() {
  try {
    const response = await fetch('https://www.swod.com.cn/api/platform-offline-courses', {
      headers: { Accept: 'application/json' }, cache: 'no-store',
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) return jsonError('课程目录暂时无法同步，请稍后重试', 503);
    const payload = await response.json();
    if (payload.success === false || !Array.isArray(payload.data)) return jsonError('课程目录暂时无法同步，请稍后重试', 503);
    const db = openTrainingDb();
    try {
      const courses = db.prepare("SELECT c.* FROM Course c LEFT JOIN CourseTemplate t ON t.id=c.templateId WHERE COALESCE(c.name, '') <> '' AND COALESCE(c.status, 'active') <> 'deleted' AND COALESCE(t.websiteVisible, 1)=1 AND COALESCE(c.category, '') NOT LIKE '%演示%' AND COALESCE(c.name, '') NOT LIKE '%测试%'").all();
      const payments = db.prepare("SELECT courseId, memberId, paymentStatus FROM Payment WHERE memberId > 0 AND paymentStatus IN ('paid', 'completed')").all();
      return noStoreJson({ success: true, data: miniOfflineCatalog(courses, payload.data, payments) });
    } finally { db.close(); }
  } catch {
    return jsonError('课程目录暂时无法同步，请稍后重试', 503);
  }
}
