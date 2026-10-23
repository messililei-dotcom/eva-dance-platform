import { NextRequest } from 'next/server';
import { proxyCertificate } from '../../_proxy';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return proxyCertificate(request, (await params).id, 'preview');
}
