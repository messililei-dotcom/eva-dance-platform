import { NextRequest } from 'next/server';
import { proxyMiniApi } from '../../../../learn/_mini-proxy';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return proxyMiniApi(request, `/mini/member/messages/unread-count${request.nextUrl.search}`);
}
