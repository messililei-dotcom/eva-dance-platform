import { AUTHORIZATION_FINANCIAL_SQL } from './authorization-revenue';
import type { AdminDb } from './admin-db';

export function ensureAuthorizationCommissionColumns(db: AdminDb) {
  const columns = new Set(db.prepare('PRAGMA table_info(CourseAuthorization)').all().map(row => row.name));
  if (!columns.size) return false;
  for (const [name, definition] of [
    ['actual_amount', 'REAL'], ['sales', "TEXT DEFAULT ''"],
    ['commission_rate', 'REAL DEFAULT 0'], ['commission_amount', 'REAL DEFAULT 0'],
  ]) {
    if (!columns.has(name)) db.exec(`ALTER TABLE CourseAuthorization ADD COLUMN ${name} ${definition}`);
  }
  return true;
}

export function authorizationFinancials(db: AdminDb, seriesId: number, input: Record<string, unknown> = {}) {
  const series = db.prepare('SELECT price, promo_price FROM CourseSeries WHERE id=?').get(seriesId);
  if (!series) throw new Error('课程不存在');
  const amount = input.actual_amount === undefined
    ? Number(series.promo_price ?? series.price ?? 0) : Number(input.actual_amount);
  const rate = input.commission_rate === undefined ? 0 : Number(input.commission_rate);
  if (input.actual_amount === null || input.actual_amount === '' || !Number.isFinite(amount) || amount < 0 || amount > 999999999) throw new Error('请输入有效的实收金额');
  if (input.commission_rate === null || input.commission_rate === '' || !Number.isFinite(rate) || rate < 0 || rate > 100) throw new Error('提成比例应为 0–100%');
  const sales = String(input.sales ?? '').trim();
  if ((rate > 0 || ['actual_amount', 'sales', 'commission_rate', 'commission_amount'].some(key => Object.prototype.hasOwnProperty.call(input, key))) && !sales) throw new Error('请填写课程顾问');
  const paid = Math.round(amount * 100) / 100;
  let percentage = Math.round(rate * 100) / 100;
  let commission = Math.round(paid * percentage) / 100;
  if (input.commission_amount !== undefined) {
    const entered = Number(input.commission_amount);
    if (input.commission_amount === null || input.commission_amount === '' || !Number.isFinite(entered) || entered < 0 || entered > paid) {
      throw new Error('提成金额应在0至实收金额之间');
    }
    commission = Math.round(entered * 100) / 100;
    percentage = paid > 0 ? Math.round(commission / paid * 10000) / 100 : 0;
  }
  if (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='CommissionSettlement'").get()) {
    const locked = db.prepare(`SELECT 1 FROM CommissionSettlement WHERE periodType='month'
      AND period=strftime('%Y-%m','now','localtime') AND advisor=? AND status='settled'`).get(sales || '未填写顾问');
    if (locked) throw new Error('该顾问本月提成已结清，请先取消结清再新增授权');
  }
  return { amount: paid, sales, rate: percentage, commission };
}

export function onlineAuthorizationCommissions(db: AdminDb) {
  if (!ensureAuthorizationCommissionColumns(db)) return [];
  // Only new, explicitly recorded receipts participate; historical grants are not guessed.
  return db.prepare(`SELECT id, 'online' AS source, member_id AS memberId,
    memberName, memberPhone, series_id AS courseId, course AS courseName, '线上课程' AS courseSubType,
    actual_amount AS amount, substr(granted_at,1,10) AS date,
    sales, commission_rate AS commissionRate, commission_amount AS commissionAmount,
    remark, granted_at AS created_at
    FROM (${AUTHORIZATION_FINANCIAL_SQL}) WHERE actual_amount IS NOT NULL AND status='active'
    ORDER BY granted_at DESC, id DESC`).all();
}
