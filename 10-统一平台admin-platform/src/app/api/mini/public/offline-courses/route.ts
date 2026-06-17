import { jsonError } from '../../_helpers';
import { openTrainingDb } from '../../../training-db';
import { publicShortCacheJson } from '@/lib/http-cache';

export const dynamic = 'force-dynamic';

function offlineCourseCoverImage(row: any) {
  const coverImage = String(row.coverImage || '').trim();
  const name = String(row.name || '').trim();
  if (/^https?:\/\//i.test(coverImage)) return coverImage;
  if (!coverImage && !name) return '';
  const params = new URLSearchParams();
  if (coverImage) params.set('src', coverImage);
  if (name) params.set('name', name);
  return `/api/courses/cover-image?${params.toString()}`;
}

export async function GET() {
  const db = openTrainingDb();
  try {
    const rows = db.prepare(`
      SELECT *
      FROM Course
      WHERE COALESCE(name, '') <> ''
      ORDER BY COALESCE(NULLIF(startDate, ''), created_at) DESC, id DESC
    `).all();

    return publicShortCacheJson({
      success: true,
      data: rows.map((row: any) => ({
        id: 900000 + Number(row.id || 0),
        name: row.name || '线下培训学习',
        subtitle: row.content || row.subType || row.type || '',
        category: row.type || '线下学习',
        teacher: row.teacher || '伊娃',
        price: Number(row.price) || 0,
        promo_price: Number(row.price) || 0,
        is_free: Number(row.price) > 0 ? 0 : 1,
        cover_image: offlineCourseCoverImage(row),
        status: 'published',
        description: row.content || '',
        source_type: 'platform_offline_course',
        source_id: String(row.id || ''),
        source_name: '统一平台线下学习',
        start_date: row.startDate || '',
        end_date: row.endDate || '',
        valid_days: row.validDays || '',
        total_courses: Number(row.sessions) || 0,
        total_students: 0,
        created_at: row.created_at || '',
      })),
    });
  } catch (err: any) {
    return jsonError(err.message);
  } finally {
    db.close();
  }
}
