import { withDb, jsonError } from '../../_helpers';
import { getMiniFeatures } from '@/lib/server/mini-features';

export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    return withDb(db => Response.json({ success: true, data: getMiniFeatures(db) }, {
      headers: { 'Cache-Control': 'no-store' }
    }));
  } catch {
    return jsonError('读取功能配置失败', 503);
  }
}
