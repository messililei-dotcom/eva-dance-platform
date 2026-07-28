import { openAdminDb } from '@/lib/server/admin-db';
import { publishCourseUpdate } from '@/lib/server/inbox';
import { authPayloadFromRequest, jsonError, requireOnlineCoursePermission } from '../../../../training-db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const permissionError = requireOnlineCoursePermission(request, 'edit');
  if (permissionError) return permissionError;
  const routeParams = await params;
  const seriesId = Number(routeParams.id || 0);
  if (!seriesId) return jsonError('课程不存在', 404);
  const body = await request.json().catch(() => ({}));
  const actor = authPayloadFromRequest(request);
  const db = openAdminDb();
  try {
    return Response.json({
      success: true,
      data: publishCourseUpdate(db, {
        seriesId,
        title: String(body.title || ''),
        summary: String(body.summary || ''),
        publishedBy: String(actor?.username || actor?.id || ''),
      }),
    });
  } catch (error: any) {
    return jsonError(error?.message || '课程更新发布失败');
  } finally {
    db.close();
  }
}
