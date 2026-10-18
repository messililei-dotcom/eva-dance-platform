import { onlineAuthorizationCommissions } from '@/lib/server/authorization-commission';
import { cleanText, hasAuth, authPayloadFromRequest, jsonError, nowIso, openTrainingDb, toNumber, unauthorized } from '../training-db';

import { findLocalUser } from '../_local-auth';
import { bonusPermissions } from '@/lib/server/bonus-permissions';

export const dynamic = 'force-dynamic';

const AUTO_EXPENSE_MARKER = 'AUTO_COMMISSION_SETTLEMENT';

function getColumns(db: any, table: string) {
  return new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((row: any) => String(row.name)));
}

function ensureFinanceColumn(db: any, column: string, definition: string) {
  const columns = getColumns(db, 'FinanceExpense');
  if (!columns.has(column)) {
    db.prepare(`ALTER TABLE FinanceExpense ADD COLUMN ${column} ${definition}`).run();
  }
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
  ensureFinanceColumn(db, 'category', "TEXT NOT NULL DEFAULT '日常支出'");
  ensureFinanceColumn(db, 'title', "TEXT NOT NULL DEFAULT '支出流水'");
  ensureFinanceColumn(db, 'amount', 'REAL NOT NULL DEFAULT 0');
  ensureFinanceColumn(db, 'expense_date', "TEXT DEFAULT ''");
  ensureFinanceColumn(db, 'payment_method', "TEXT DEFAULT ''");
  ensureFinanceColumn(db, 'remark', "TEXT DEFAULT ''");
  ensureFinanceColumn(db, 'created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
}

function nextExpenseNo(db: any) {
  const date = db.prepare("SELECT strftime('%Y%m%d', 'now', 'localtime') AS value").get() as { value?: string } | undefined;
  const prefix = `EXP-${date?.value || new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
  const row = db.prepare("SELECT COUNT(*) AS count FROM FinanceExpense WHERE expenseNo LIKE ?").get(`${prefix}%`) as { count?: number } | undefined;
  return `${prefix}-${String(Number(row?.count || 0) + 1).padStart(4, '0')}`;
}

function settlementExpenseMarker(advisor: string, period: string) {
  return `${AUTO_EXPENSE_MARKER}|month|${period}|${advisor}`;
}

function commissionTotalForMonth(db: any, advisor: string, period: string) {
  const row = db.prepare(`
    SELECT
      COUNT(*) AS paymentCount,
      COALESCE(SUM(amount), 0) AS paidAmount,
      COALESCE(SUM(COALESCE(commissionAmount, ROUND(amount * COALESCE(commissionRate, 0) / 100.0, 2))), 0) AS commissionAmount
    FROM Payment
    WHERE
      (CASE WHEN TRIM(COALESCE(sales, '')) = '' THEN '未填写顾问' ELSE TRIM(sales) END) = ?
      AND (
        CASE
          WHEN COALESCE(NULLIF(date, ''), created_at, '') GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]*'
          THEN substr(COALESCE(NULLIF(date, ''), created_at), 1, 7)
          ELSE '未标记'
        END
      ) = ?
  `).get(advisor, period) as { paymentCount?: number; paidAmount?: number; commissionAmount?: number } | undefined;

  const online = onlineAuthorizationCommissions(db).filter(item =>
    (String(item.sales || '').trim() || '未填写顾问') === advisor && String(item.date || '').slice(0, 7) === period);
  return {
    paymentCount: toNumber(row?.paymentCount) + online.length,
    paidAmount: toNumber(row?.paidAmount) + online.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    commissionAmount: Math.round((toNumber(row?.commissionAmount) + online.reduce((sum, item) => sum + Number(item.commissionAmount || 0), 0)) * 100) / 100,
  };
}

function deleteAutoCommissionExpense(db: any, advisor: string, period: string) {
  ensureFinanceExpenseTable(db);
  const marker = settlementExpenseMarker(advisor, period);
  db.prepare('DELETE FROM FinanceExpense WHERE remark LIKE ?').run(`%${marker}%`);
}

function upsertAutoCommissionExpense(db: any, advisor: string, period: string) {
  ensureFinanceExpenseTable(db);
  const totals = commissionTotalForMonth(db, advisor, period);
  const marker = settlementExpenseMarker(advisor, period);

  if (totals.commissionAmount <= 0) {
    db.prepare('DELETE FROM FinanceExpense WHERE remark LIKE ?').run(`%${marker}%`);
    return { amount: 0, paymentCount: totals.paymentCount };
  }

  const columns = getColumns(db, 'FinanceExpense');
  const expenseDate = (db.prepare("SELECT date('now', 'localtime') AS value").get() as { value?: string } | undefined)?.value
    || new Date().toISOString().slice(0, 10);
  const title = `${advisor} ${period} 奖金提成`;
  const remark = [
    `系统自动生成：${advisor} ${period} 提成结清`,
    `关联缴费 ${totals.paymentCount} 笔，实付合计 ${totals.paidAmount.toFixed(2)} 元`,
    marker,
  ].join('\n');
  const valuesByColumn: Record<string, unknown> = {
    expenseDate,
    category: '奖金提成',
    title,
    amount: totals.commissionAmount,
    expense_date: expenseDate,
    payment_method: '系统结清',
    account: '系统结清',
    payee: advisor,
    handler: '超级管理员',
    paidStatus: '已付款',
    remark,
    createdBy: 'system',
  };
  const existing = db.prepare('SELECT id FROM FinanceExpense WHERE remark LIKE ? ORDER BY id DESC LIMIT 1').get(`%${marker}%`) as { id?: number } | undefined;

  if (existing?.id) {
    db.prepare('DELETE FROM FinanceExpense WHERE remark LIKE ? AND id <> ?').run(`%${marker}%`, existing.id);
    const updateColumns = Object.keys(valuesByColumn).filter(column => columns.has(column));
    const assignments = updateColumns.map(column => `${column} = ?`);
    const values = updateColumns.map(column => valuesByColumn[column]);
    if (columns.has('updated_at')) {
      assignments.push("updated_at = datetime('now', 'localtime')");
    }
    db.prepare(`UPDATE FinanceExpense SET ${assignments.join(', ')} WHERE id = ?`).run(...values, existing.id);
    return { amount: totals.commissionAmount, paymentCount: totals.paymentCount, expenseId: existing.id };
  }

  if (columns.has('expenseNo')) {
    valuesByColumn.expenseNo = nextExpenseNo(db);
  }
  const insertColumns = Object.keys(valuesByColumn).filter(column => columns.has(column));
  const placeholders = insertColumns.map(() => '?');
  const values = insertColumns.map(column => valuesByColumn[column]);
  if (columns.has('created_at')) {
    insertColumns.push('created_at');
    placeholders.push("datetime('now', 'localtime')");
  }
  if (columns.has('updated_at')) {
    insertColumns.push('updated_at');
    placeholders.push("datetime('now', 'localtime')");
  }
  const result = db.prepare(`
    INSERT INTO FinanceExpense (${insertColumns.join(', ')})
    VALUES (${placeholders.join(', ')})
  `).run(...values);
  return { amount: totals.commissionAmount, paymentCount: totals.paymentCount, expenseId: result.lastInsertRowid };
}

export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const db = openTrainingDb();
  try {
    const rows = db.prepare(`
      SELECT *
      FROM CommissionSettlement
      WHERE periodType = 'month'
      ORDER BY period DESC, advisor ASC
    `).all();
    return Response.json(rows);
  } finally {
    db.close();
  }
}

export async function POST(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const payload = authPayloadFromRequest(request);
  const actor = payload ? findLocalUser(payload.username) : null;
  if (!bonusPermissions(actor).canPay) {
    return Response.json({ success: false, error: '仅李雷可修改历史结清状态' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const period = cleanText(body.period);
  const advisor = cleanText(body.advisor, '未填写顾问');
  const status = cleanText(body.status, 'unsettled') === 'settled' ? 'settled' : 'unsettled';
  if (!/^\d{4}-\d{2}$/.test(period) && period !== '未标记') {
    return Response.json({ success: false, error: '请选择有效月份' }, { status: 400 });
  }

  const db = openTrainingDb();
  try {
    const hasNewSettlement = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='BonusMonthly'").get();
    if (hasNewSettlement && db.prepare('SELECT 1 FROM BonusMonthly WHERE period=? AND person=?').get(period, advisor)) {
      return Response.json({ error: '该月使用新版审核与发放流程，请在月度结算中操作' }, { status: 409 });
    }
    const now = nowIso();
    const result = db.transaction(() => {
      db.prepare(`
        INSERT INTO CommissionSettlement (
          periodType, period, advisor, status, settledAt, settledBy, updated_at
        )
        VALUES ('month', ?, ?, ?, ?, ?, ?)
        ON CONFLICT(periodType, period, advisor)
        DO UPDATE SET
          status = excluded.status,
          settledAt = excluded.settledAt,
          settledBy = excluded.settledBy,
          updated_at = excluded.updated_at
      `).run(
        period,
        advisor,
        status,
        status === 'settled' ? now : '',
        '超级管理员',
        now,
      );

      if (status === 'settled') {
        return upsertAutoCommissionExpense(db, advisor, period);
      }
      deleteAutoCommissionExpense(db, advisor, period);
      return { amount: 0 };
    })();
    return Response.json({ success: true, expense: result });
  } catch (err: any) {
    return jsonError(err?.message, 400, '结清状态保存失败');
  } finally {
    db.close();
  }
}
