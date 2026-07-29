import { openAdminDb } from '@/lib/server/admin-db';

export const dynamic = 'force-dynamic';

function cleanText(value: unknown, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function getColumns(db: any) {
  return new Set(db.prepare('PRAGMA table_info(FinanceExpense)').all().map((row: any) => row.name));
}

function ensureFinanceExpenseTable(db: any) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS FinanceExpense (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL DEFAULT '日常支出',
      title TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      expense_date TEXT DEFAULT '',
      payment_method TEXT DEFAULT '',
      remark TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  ensureColumn(db, 'category', "TEXT NOT NULL DEFAULT '日常支出'");
  ensureColumn(db, 'title', "TEXT NOT NULL DEFAULT '支出流水'");
  ensureColumn(db, 'amount', 'REAL NOT NULL DEFAULT 0');
  ensureColumn(db, 'expense_date', "TEXT DEFAULT ''");
  ensureColumn(db, 'payment_method', "TEXT DEFAULT ''");
  ensureColumn(db, 'remark', "TEXT DEFAULT ''");
  ensureColumn(db, 'created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
}

function ensureColumn(db: any, column: string, definition: string) {
  const columns = getColumns(db);
  if (!columns.has(column)) {
    db.prepare(`ALTER TABLE FinanceExpense ADD COLUMN ${column} ${definition}`).run();
  }
}

function nextExpenseNo(db: any) {
  const prefix = `EXP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
  const row = db.prepare("SELECT COUNT(*) AS count FROM FinanceExpense WHERE expenseNo LIKE ?").get(`${prefix}%`) as { count?: number } | undefined;
  return `${prefix}-${String(Number(row?.count || 0) + 1).padStart(4, '0')}`;
}

export async function GET() {
  const db = openAdminDb({ readonly: true });
  try {
    const table = db.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'FinanceExpense'",
    ).get();
    if (!table) return Response.json([]);
    const columns = getColumns(db);
    const titleExpr = columns.has('title') ? 'title' : "COALESCE(NULLIF(remark, ''), category)";
    const dateExpr = columns.has('expense_date') && columns.has('expenseDate')
      ? "COALESCE(NULLIF(expense_date, ''), expenseDate)"
      : columns.has('expense_date')
        ? 'expense_date'
        : 'expenseDate';
    const paymentExpr = columns.has('payment_method') && columns.has('account')
      ? "COALESCE(NULLIF(payment_method, ''), account)"
      : columns.has('payment_method')
        ? 'payment_method'
        : columns.has('account')
          ? 'account'
          : "''";
    const rows = db.prepare(`
      SELECT id, category, ${titleExpr} AS title, amount, ${dateExpr} AS expense_date, ${paymentExpr} AS payment_method, remark, created_at
      FROM FinanceExpense
      ORDER BY datetime(COALESCE(NULLIF(${dateExpr}, ''), created_at)) DESC, id DESC
    `).all();
    return Response.json(rows);
  } finally {
    db.close();
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const amount = toNumber(body.amount);
  const title = cleanText(body.title);

  if (!title) return Response.json({ success: false, error: '请填写支出项目' }, { status: 400 });
  if (amount <= 0) return Response.json({ success: false, error: '支出金额必须大于 0' }, { status: 400 });

  const db = openAdminDb();
  try {
    ensureFinanceExpenseTable(db);
    const columns = getColumns(db);
    const category = cleanText(body.category, '日常支出');
    const expenseDate = cleanText(body.expense_date ?? body.expenseDate ?? body.date, new Date().toISOString().slice(0, 10));
    const paymentMethod = cleanText(body.payment_method ?? body.paymentMethod, '微信');
    const remark = cleanText(body.remark ?? body.note);
    const valuesByColumn: Record<string, unknown> = {
      expenseDate,
      category,
      title,
      amount,
      expense_date: expenseDate,
      payment_method: paymentMethod,
      account: paymentMethod,
      payee: title,
      handler: '',
      paidStatus: '已付款',
      remark,
      createdBy: 'admin',
    };
    if (columns.has('expenseNo')) {
      valuesByColumn.expenseNo = nextExpenseNo(db);
    }
    const insertColumns = Object.keys(valuesByColumn).filter(column => columns.has(column));
    const placeholders = insertColumns.map(() => '?');
    if (columns.has('created_at')) {
      insertColumns.push('created_at');
      placeholders.push("datetime('now','localtime')");
    }
    if (columns.has('updated_at')) {
      insertColumns.push('updated_at');
      placeholders.push("datetime('now','localtime')");
    }
    const result = db.prepare(`
      INSERT INTO FinanceExpense (${insertColumns.join(', ')})
      VALUES (${placeholders.join(', ')})
    `).run(...insertColumns.filter(column => column in valuesByColumn).map(column => valuesByColumn[column]));
    return Response.json({ success: true, id: result.lastInsertRowid });
  } catch (error: any) {
    console.error('Create finance expense failed:', error);
    return Response.json({ success: false, error: '新增支出失败' }, { status: 500 });
  } finally {
    db.close();
  }
}
