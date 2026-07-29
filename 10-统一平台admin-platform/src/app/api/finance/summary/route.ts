import { openAdminDb } from '@/lib/server/admin-db';

export const dynamic = 'force-dynamic';

function amount(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function tableExists(db: ReturnType<typeof openAdminDb>, table: string) {
  return Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));
}

function columnsOf(db: ReturnType<typeof openAdminDb>, table: string) {
  if (!tableExists(db, table)) return new Set<string>();
  return new Set(
    db.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>().map(row => String(row.name)),
  );
}

function expenseRows(db: ReturnType<typeof openAdminDb>) {
  const columns = columnsOf(db, 'FinanceExpense');
  if (!columns.size) return [];

  const titleExpr = columns.has('title') ? 'title' : "COALESCE(NULLIF(remark, ''), category)";
  const dateExpr = columns.has('expense_date') && columns.has('expenseDate')
    ? "COALESCE(NULLIF(expense_date, ''), expenseDate)"
    : columns.has('expense_date')
      ? 'expense_date'
      : columns.has('expenseDate')
        ? 'expenseDate'
        : 'created_at';
  const paymentExpr = columns.has('payment_method') && columns.has('account')
    ? "COALESCE(NULLIF(payment_method, ''), account)"
    : columns.has('payment_method')
      ? 'payment_method'
      : columns.has('account')
        ? 'account'
        : "''";

  return db.prepare(`
    SELECT id, category, ${titleExpr} AS title, amount, ${dateExpr} AS expense_date,
           ${paymentExpr} AS payment_method, remark, created_at
    FROM FinanceExpense
    ORDER BY datetime(COALESCE(NULLIF(${dateExpr}, ''), created_at)) DESC, id DESC
  `).all();
}

function incomeRows(db: ReturnType<typeof openAdminDb>) {
  if (!tableExists(db, 'FinanceIncome')) return [];
  const columns = columnsOf(db, 'FinanceIncome');
  const titleExpr = columns.has('title') ? 'title' : columns.has('remark') ? 'remark' : "''";
  const dateExpr = columns.has('income_date') ? 'income_date' : columns.has('incomeDate') ? 'incomeDate' : 'created_at';
  const incomeNoExpr = columns.has('incomeNo') ? 'incomeNo' : "''";
  const categoryExpr = columns.has('category') ? 'category' : "'财务收入'";
  const paymentExpr = columns.has('payment_method') && columns.has('account')
    ? "COALESCE(NULLIF(payment_method, ''), account)"
    : columns.has('payment_method')
      ? 'payment_method'
      : columns.has('account')
        ? 'account'
        : "''";
  const memberNameExpr = columns.has('memberName') && columns.has('payer')
    ? "COALESCE(NULLIF(memberName, ''), payer)"
    : columns.has('memberName')
      ? 'memberName'
      : columns.has('payer')
        ? 'payer'
        : "''";
  const memberIdExpr = columns.has('memberId') ? 'memberId' : '0';

  return db.prepare(`
    SELECT id, ${incomeNoExpr} AS incomeNo, ${categoryExpr} AS category,
           ${titleExpr} AS title, amount, ${dateExpr} AS income_date,
           ${paymentExpr} AS payment_method, ${memberNameExpr} AS memberName,
           ${memberIdExpr} AS memberId, remark, created_at
    FROM FinanceIncome
    ORDER BY datetime(COALESCE(NULLIF(${dateExpr}, ''), created_at)) DESC, id DESC
  `).all();
}

export async function GET() {
  const db = openAdminDb({ readonly: true });
  try {
    const incomeRecords = incomeRows(db);
    const expenseRecords = expenseRows(db);
    return Response.json({
      totalIncome: incomeRecords.reduce((sum: number, row: any) => sum + amount(row.amount), 0),
      totalExpense: expenseRecords.reduce((sum: number, row: any) => sum + amount(row.amount), 0),
      incomeRecords,
      expenseRecords,
    });
  } finally {
    db.close();
  }
}
