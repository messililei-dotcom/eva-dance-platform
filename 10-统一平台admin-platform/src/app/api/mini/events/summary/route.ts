import { noStoreJson } from '@/lib/http-cache';
import { loadEventPlatformTotals } from '@/lib/event-platform-totals';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET() {
  try { return noStoreJson({ success: true, data: loadEventPlatformTotals() }); }
  catch { return noStoreJson({ success: false, error: '赛事统计暂不可用，请稍后重试' }, { status: 503 }); }
}
