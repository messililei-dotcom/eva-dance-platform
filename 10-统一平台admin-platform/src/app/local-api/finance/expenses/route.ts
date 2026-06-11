import { GET as getExpenses, POST as postExpense } from '@/app/api/finance/expenses/route';
import { hasAuth, unauthorized } from '@/app/api/training-db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  return getExpenses();
}

export async function POST(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  return postExpense(request);
}
