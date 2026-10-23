import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Web Push subscription seam. No subscription is retained until a dedicated
 * notification service URL is configured, so production cannot silently lose
 * or leak endpoint data.
 */
export async function POST(request: NextRequest) {
  const webhook = process.env.WEB_PUSH_SUBSCRIPTION_URL;
  if (!webhook) {
    return NextResponse.json(
      { success: false, code: 'PUSH_NOT_CONFIGURED', message: '推送服务尚未启用' },
      { status: 501 },
    );
  }

  const body = await request.text();
  const response = await fetch(webhook, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(request.headers.get('authorization')
        ? { Authorization: request.headers.get('authorization') as string }
        : {}),
    },
    body,
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  });
  const payload = await response.text();
  return new NextResponse(payload || '{}', {
    status: response.status,
    headers: { 'Content-Type': response.headers.get('content-type') || 'application/json' },
  });
}
