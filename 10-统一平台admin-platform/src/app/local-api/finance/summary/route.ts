import { hasAuth, unauthorized } from '@/app/api/training-db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  return Response.json({
    totalIncome: 0,
    totalExpense: 0,
    incomeRecords: [],
    expenseRecords: [],
  });
}
