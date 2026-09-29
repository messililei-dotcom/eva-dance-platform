import { openTrainingDb, requirePermission, toNumber } from '../../training-db';

export const dynamic = 'force-dynamic';

type CommissionRow = {
  id: number;
  advisor: string;
  memberName: string;
  memberPhone: string;
  courseName: string;
  courseSubType: string;
  paymentAmount: number;
  commissionRate: number;
  commissionAmount: number;
  paymentMethod: string;
  date: string;
  remark: string;
};

type AdvisorSummary = {
  advisor: string;
  paymentCount: number;
  paymentAmount: number;
  commissionAmount: number;
  monthCommission: number;
  yearCommission: number;
  averageRate: number;
  latestDate: string;
};

function cleanText(value: unknown, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function dateText(value: unknown) {
  return cleanText(value, new Date().toISOString()).replace('T', ' ').slice(0, 10);
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function normalizeMonth(value: unknown) {
  const text = cleanText(value);
  return /^\d{4}-\d{2}$/.test(text) ? text : currentMonthKey();
}

function normalizeYear(value: unknown) {
  const text = cleanText(value);
  return /^\d{4}$/.test(text) ? text : String(new Date().getFullYear());
}

function commissionAmount(amountValue: unknown, rateValue: unknown, storedValue: unknown) {
  const stored = toNumber(storedValue);
  if (stored > 0) return stored;
  const amount = Math.max(0, toNumber(amountValue));
  const rate = Math.min(100, Math.max(0, toNumber(rateValue)));
  return Math.round(amount * rate) / 100;
}

function tableExists(db: any, table: string) {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
  return Boolean(row);
}

export async function GET(request: Request) {
  const permissionError = requirePermission(request, 'permPaymentView', '无权限查看奖金提成');
  if (permissionError) return permissionError;

  const url = new URL(request.url);
  const month = normalizeMonth(url.searchParams.get('month'));
  const year = normalizeYear(url.searchParams.get('year'));
  const db = openTrainingDb();

  try {
    const payments = tableExists(db, 'Payment')
      ? db.prepare(`
          SELECT
            p.id, p.memberName, p.memberPhone, p.courseName, COALESCE(c.subType, '') AS courseSubType,
            p.amount, p.date, p.payment, p.sales, p.remark, p.paymentStatus,
            p.commissionRate, p.commissionAmount, p.created_at
          FROM Payment p
          LEFT JOIN Course c ON c.id = p.courseId
          ORDER BY COALESCE(NULLIF(p.date, ''), p.created_at) DESC, p.id DESC
        `).all()
      : [];

    const blockedStatuses = new Set(['pending', 'closed', 'cancelled', 'canceled', 'refunded', '待付款', '待支付', '已关闭', '已取消', '已退款']);
    const rows: CommissionRow[] = payments
      .filter((row: any) => !blockedStatuses.has(cleanText(row.paymentStatus, 'paid')))
      .map((row: any) => {
        const date = dateText(row.date || row.created_at);
        const paymentAmount = Math.max(0, toNumber(row.amount));
        const rate = Math.min(100, Math.max(0, toNumber(row.commissionRate)));
        return {
          id: Number(row.id),
          advisor: cleanText(row.sales, '未填写'),
          memberName: cleanText(row.memberName),
          memberPhone: cleanText(row.memberPhone),
          courseName: cleanText(row.courseName, '线下课程'),
          courseSubType: cleanText(row.courseSubType),
          paymentAmount,
          commissionRate: rate,
          commissionAmount: commissionAmount(paymentAmount, rate, row.commissionAmount),
          paymentMethod: cleanText(row.payment, '-'),
          date,
          remark: cleanText(row.remark),
        };
      })
      .filter(row => row.paymentAmount > 0 || row.commissionAmount > 0);

    const advisorMap = new Map<string, AdvisorSummary & { rateTotal: number; rateCount: number }>();
    rows.forEach(row => {
      const current = advisorMap.get(row.advisor) || {
        advisor: row.advisor,
        paymentCount: 0,
        paymentAmount: 0,
        commissionAmount: 0,
        monthCommission: 0,
        yearCommission: 0,
        averageRate: 0,
        latestDate: '',
        rateTotal: 0,
        rateCount: 0,
      };
      current.paymentCount += 1;
      current.paymentAmount += row.paymentAmount;
      current.commissionAmount += row.commissionAmount;
      if (row.date.startsWith(month)) current.monthCommission += row.commissionAmount;
      if (row.date.startsWith(year)) current.yearCommission += row.commissionAmount;
      if (row.commissionRate > 0) {
        current.rateTotal += row.commissionRate;
        current.rateCount += 1;
      }
      if (!current.latestDate || row.date > current.latestDate) current.latestDate = row.date;
      advisorMap.set(row.advisor, current);
    });

    const advisors = Array.from(advisorMap.values())
      .map(({ rateTotal, rateCount, ...item }) => ({
        ...item,
        averageRate: rateCount ? Math.round((rateTotal / rateCount) * 100) / 100 : 0,
      }))
      .sort((a, b) => b.commissionAmount - a.commissionAmount);

    const monthRows = rows.filter(row => row.date.startsWith(month));
    const yearRows = rows.filter(row => row.date.startsWith(year));

    return Response.json({
      month,
      year,
      totals: {
        totalCommission: rows.reduce((sum, row) => sum + row.commissionAmount, 0),
        monthCommission: monthRows.reduce((sum, row) => sum + row.commissionAmount, 0),
        yearCommission: yearRows.reduce((sum, row) => sum + row.commissionAmount, 0),
        advisorCount: advisors.filter(item => item.commissionAmount > 0 || item.paymentAmount > 0).length,
        detailCount: rows.length,
      },
      advisors,
      details: rows,
    });
  } catch (error) {
    console.error('Finance commissions failed:', error);
    return Response.json({ success: false, error: '奖金提成统计失败' }, { status: 500 });
  } finally {
    db.close();
  }
}
