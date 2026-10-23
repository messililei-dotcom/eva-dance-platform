import { NextRequest } from 'next/server';
import { publicCourseCatalog } from '../_public-course-catalog';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  return publicCourseCatalog(request, routeParams.id);
}
