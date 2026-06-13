import { getMemberId, jsonError, recordSeriesVisit, toPositiveInt, withDb } from '../../_helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    return withDb((db) => {
      const memberId = getMemberId(new URL(request.url).searchParams, request);
      if (!memberId) return jsonError('未登录', 401);

      const seriesId = toPositiveInt(body.series_id);
      if (!seriesId) return jsonError('请选择要申请授权的课程', 400);

      const series = db.prepare("SELECT id, name FROM CourseSeries WHERE id=? AND status='published'").get<{ id: number; name: string }>(seriesId);
      if (!series) return jsonError('课程不存在或未发布', 404);

      recordSeriesVisit(db, seriesId, memberId, 'auth_request');
      const visit = db.prepare(
        `SELECT first_visited_at, last_visited_at, visit_count, source
         FROM CourseSeriesVisit
         WHERE member_id=? AND series_id=?`
      ).get(memberId, seriesId);

      return Response.json({
        success: true,
        message: '授权申请已提交，请等待管理员开通课程权限',
        data: {
          series_id: series.id,
          series_name: series.name,
          member_id: memberId,
          ...(visit || {}),
        },
      });
    });
  } catch (err: any) {
    return jsonError(err?.message || '授权申请提交失败');
  }
}
