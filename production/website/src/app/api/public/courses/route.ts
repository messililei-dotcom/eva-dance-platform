import { noStoreJson } from '@/lib/http-cache';
import { getPlatformOfflineCourses } from '../../platform-offline-courses/_shared';
import { jsonError } from '../../platform-courses/_db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    return noStoreJson({
      success: true,
      data: getPlatformOfflineCourses(),
    });
  } catch (err: any) {
    return jsonError(err?.message || '获取平台线下课程失败');
  }
}
