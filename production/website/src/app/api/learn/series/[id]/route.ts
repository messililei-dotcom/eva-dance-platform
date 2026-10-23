import { NextRequest } from 'next/server';
import { proxyMiniApi } from '../../_mini-proxy';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  return proxyMiniApi(request, `/mini/public/series/${encodeURIComponent(routeParams.id)}`);
}
