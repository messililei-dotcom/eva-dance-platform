import { NextRequest } from 'next/server';
import { proxyMiniApi } from '../../../learn/_mini-proxy';

export async function POST(request: NextRequest) {
  return proxyMiniApi(request, `/mini/offline/checkin${request.nextUrl.search}`);
}
