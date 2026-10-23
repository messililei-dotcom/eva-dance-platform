import { NextRequest } from 'next/server';
import { proxyMiniApi } from '../../../_mini-proxy';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  return proxyMiniApi(request, `/mini/video/${encodeURIComponent(routeParams.id)}/progress${request.nextUrl.search}`);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  return proxyMiniApi(request, `/mini/video/${encodeURIComponent(routeParams.id)}/progress${request.nextUrl.search}`);
}
