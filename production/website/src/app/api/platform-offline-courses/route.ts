import { noStoreJson } from '@/lib/http-cache';
import { jsonError } from '../platform-courses/_db';
import { getPlatformOfflineCourses } from './_shared';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const referer = request.headers.get('referer') || '';
    const isSchedulePage = /\/offline\/schedule(?:[/?#]|$)/.test(referer);
    const data = getPlatformOfflineCourses().map(course => (
      isSchedulePage ? { ...course, dateRange: '' } : course
    ));

    return noStoreJson({
      success: true,
      data,
    });
  } catch (err: any) {
    return jsonError(err?.message || '获取平台线下课程失败');
  }
}
