import { GET as getFinanceSummary } from '@/app/api/finance/summary/route';
import { hasAuth, unauthorized } from '@/app/api/training-db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  return getFinanceSummary(request);
}
