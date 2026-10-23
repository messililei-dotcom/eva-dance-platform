import { noStoreJson } from '@/lib/http-cache';
import { jsonError } from '../../platform-courses/_db';
import { getPlatformOfflineCourses } from '../_shared';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const course = getPlatformOfflineCourses().find((item) => String(item.id) === String(id));
    if (!course) return jsonError('平台线下课程不存在', 404);
    return noStoreJson({ success: true, data: course });
  } catch (err: any) {
    return jsonError(err?.message || '获取平台线下课程详情失败');
  }
}
