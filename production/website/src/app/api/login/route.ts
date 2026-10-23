import { NextRequest } from 'next/server';
import { proxyJson } from '../_proxy';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return proxyJson(request, '/login');
}
