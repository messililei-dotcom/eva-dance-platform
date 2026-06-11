import { getMemberId, jsonError, toPositiveInt, withDb } from '../../_helpers';
import { getActiveAuthorization } from '../../../course/series/[id]/_authorization';

export async function GET(request: Request) {
  try {
    return withDb((db) => {
      const url = new URL(request.url);
      const memberId = getMemberId(url.searchParams, request);
      const seriesId = toPositiveInt(url.searchParams.get('series_id'));
      if (!memberId || !seriesId) return Response.json({ success: true, data: { authorized: false, trial_available: false } });
      const member = db.prepare('SELECT phone FROM Member WHERE id=?').get<{ phone?: string }>(memberId);
      const auth = getActiveAuthorization(db, seriesId, memberId, member?.phone || '');
      const series = db.prepare('SELECT is_free, trial_count FROM CourseSeries WHERE id=?').get(seriesId);
      return Response.json({ success: true, data: { authorized: !!(auth || series?.is_free), trial_available: Number(series?.trial_count || 0) > 0, auth_type: auth?.type || null } });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
