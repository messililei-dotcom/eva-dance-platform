import { NextRequest } from 'next/server';
import { proxyMiniApi } from '../../../../learn/_mini-proxy';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return proxyMiniApi(request, '/mini/member/messages/read-all');
}
