import { withDb } from '@/app/api/mini/_helpers';
import { createWechatLoginHandoff, failWechatLoginHandoff } from '@/lib/server/wechat-login-handoff';
import { createMiniAppLoginUrlLink } from '@/lib/server/wechat-miniapp-url-link';

export const dynamic = 'force-dynamic';

export async function GET() {
  let handoffId = '';
  try {
    const handoff = withDb((db) => createWechatLoginHandoff(db));
    handoffId = handoff.id;
    const openUrl = await createMiniAppLoginUrlLink(handoff.id);
    return Response.json({
      success: true,
      openUrl,
      handoffId: handoff.id,
      pollToken: handoff.pollToken,
      expiresAt: handoff.expiresAt,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (handoffId) {
      try {
        withDb((db) => failWechatLoginHandoff(db, handoffId, '暂时无法唤起微信小程序'));
      } catch {}
    }
    return Response.json({
      success: false,
      message: error instanceof Error ? error.message : '微信一键登录暂不可用',
    }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
