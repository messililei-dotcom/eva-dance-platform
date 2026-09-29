import { getGrowthSummary, listGrowthLedger } from '@/lib/server/student-growth';
import { getMemberId, jsonError, withDb } from '../../_helpers';

export async function GET(request: Request) {
  try {
    return withDb(db => {
      const memberId = getMemberId(new URL(request.url).searchParams, request);
      if (!memberId) return jsonError('未登录', 401);
      const growth = getGrowthSummary(db, memberId);
      if (!growth) return jsonError('学员不存在', 404);
      return Response.json({ success: true, data: { growth, ledger: listGrowthLedger(db, memberId, 100) } });
    });
  } catch (error: any) {
    return jsonError(error?.message || '成长档案加载失败');
  }
}
