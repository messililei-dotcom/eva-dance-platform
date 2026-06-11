export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({
    totalIncome: 0,
    totalExpense: 0,
    incomeRecords: [],
    expenseRecords: [],
  });
}
