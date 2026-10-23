import { NextRequest } from 'next/server';
import { proxyMiniApi } from '../_mini-proxy';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return proxyMiniApi(request, `/mini/member/authorized-series${request.nextUrl.search}`);
}
