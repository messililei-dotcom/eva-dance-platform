import { NextRequest } from 'next/server';
import { proxyMiniApi } from '../../../../../learn/_mini-proxy';

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  return proxyMiniApi(request, `/mini/member/messages/${encodeURIComponent(routeParams.id)}/read`);
}
