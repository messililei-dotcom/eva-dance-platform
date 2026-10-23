import { NextRequest } from 'next/server';
import { proxyMiniApi } from '../../../../learn/_mini-proxy';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyMiniApi(
    request,
    `/mini/offline/bookings/${encodeURIComponent(id)}${request.nextUrl.search}`,
  );
}
