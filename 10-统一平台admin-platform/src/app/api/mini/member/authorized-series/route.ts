import { getMemberId, jsonError, linkedMemberIds, withDb } from '../../_helpers';
import { listAuthorizedSeriesForMember } from '../../../course/series/[id]/_authorization';

export async function GET(request: Request) {
  try {
    return withDb((db) => {
      const memberId = getMemberId(new URL(request.url).searchParams, request);
      if (!memberId) return jsonError('未登录', 401);
      const seen = new Set<number>();
      const rows = linkedMemberIds(db, memberId)
        .flatMap(id => listAuthorizedSeriesForMember(db, id))
        .filter((row: any) => {
          const seriesId = Number(row.series_id || row.seriesId || row.id || 0);
          if (!seriesId || seen.has(seriesId)) return false;
          seen.add(seriesId);
          return true;
        });
      return Response.json({ success: true, data: rows.map(row => ({ ...row, unlocked: true })) }, { headers: { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Authorization' } });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
