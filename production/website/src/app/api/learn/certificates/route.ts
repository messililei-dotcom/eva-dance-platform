import { NextRequest } from 'next/server';
import { proxyLearnList } from '../_helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return proxyLearnList(request, [
    '/mini/certificates',
    '/certificates',
  ]);
}
