import { getMemberId, jsonError, toPositiveInt, withDb } from '../../_helpers';
import { getSeriesAccessStatus } from '../../../course/series/[id]/_authorization';

export async function GET(request: Request) {
  try {
    return withDb((db) => {
      const url = new URL(request.url);
      const memberId = getMemberId(url.searchParams, request);
      const seriesId = toPositiveInt(url.searchParams.get('series_id'));
      if (!memberId || !seriesId) return Response.json({ success: true, data: { authorized: false, trial_available: false } });
      const member = db.prepare('SELECT phone FROM Member WHERE id=?').get<{ phone?: string }>(memberId);
      const access = getSeriesAccessStatus(db, seriesId, memberId, member?.phone || '');
      return Response.json({ success: true, data: access });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
