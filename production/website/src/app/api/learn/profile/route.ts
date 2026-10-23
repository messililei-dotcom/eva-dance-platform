import { NextRequest } from 'next/server';
import { proxyJson } from '../../_proxy';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return proxyJson(request, '/mini/member/profile');
}

export async function PUT(request: NextRequest) {
  return proxyJson(request, '/mini/member/profile');
}
