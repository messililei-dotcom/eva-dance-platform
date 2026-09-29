import { jsonError, toPositiveInt, withDb } from '../../../_materials';
import { hasAuth, unauthorized } from '../../../../training-db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();
  try {
    return withDb((db) => {
      const seriesId = toPositiveInt(routeParams.id);
      const data = db.prepare(
        `SELECT c.*, 
                (SELECT COUNT(*) FROM CourseVideo WHERE course_id=c.id) as video_count,
                cv.id as cv_id, cv.name as material_name, cv.material_id, COALESCE(NULLIF(cv.duration, 0), m.duration, 0) as video_duration,
                m.name as material_original_name, m.type as material_type, m.file_path as material_file_path,
                m.file_url as material_file_url, m.vod_video_id as material_vod_video_id
         FROM OnlineCourse c
         LEFT JOIN CourseVideo cv ON cv.course_id=c.id
         LEFT JOIN Material m ON m.id=cv.material_id
         WHERE c.series_id=?
         ORDER BY c.sort_order, c.id`
      ).all(seriesId);
      // Group videos by course
      const courseMap = new Map<number, any>();
      data.forEach((row: any) => {
        if (!courseMap.has(row.id)) {
          courseMap.set(row.id, { ...row, videos: [] });
        }
        if (row.material_id) {
          courseMap.get(row.id).videos.push({
            assoc_id: row.cv_id,
            id: row.cv_id,
            material_id: row.material_id,
            material_name: row.material_name,
            name: row.material_name,
            material_original_name: row.material_original_name,
            material_type: row.material_type,
            material_file_path: row.material_file_path,
            material_file_url: row.material_file_url,
            material_vod_video_id: row.material_vod_video_id,
            duration: row.video_duration,
          });
        }
      });
      const courses = Array.from(courseMap.values()).map(course => ({
        ...course,
        duration: Number(course.duration) > 0 ? course.duration
          : course.videos.reduce((sum: number, video: any) => sum + Number(video.duration || 0), 0),
      }));
      return Response.json({ success: true, data: courses });
    });
  } catch (err: any) {
    return jsonError(err?.message || '获取课节列表失败');
  }
}
