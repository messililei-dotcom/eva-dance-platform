import { openAdminDb } from '@/lib/server/admin-db';
import { hasAuth, unauthorized } from '../../training-db';

export const dynamic = 'force-dynamic';

function percent(value: number, total: number) {
  return total ? Math.round(value / total * 1000) / 10 : 0;
}

function monthKeys() {
  const now = new Date();
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  });
}

export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();

  const db = openAdminDb({ readonly: true });
  try {
    const effectiveDate = "COALESCE(NULLIF(paid_at, ''), created_at)";
    const orderStats = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN status IN ('paid', 'completed') THEN amount ELSE 0 END), 0) AS income,
        COALESCE(SUM(CASE WHEN status = 'refunded' THEN amount ELSE 0 END), 0) AS expense,
        COALESCE(SUM(CASE
          WHEN status IN ('paid', 'completed')
           AND substr(${effectiveDate}, 1, 7) = strftime('%Y-%m', 'now', 'localtime')
          THEN amount ELSE 0 END
        ), 0) AS monthIncome,
        COALESCE(SUM(CASE
          WHEN status IN ('paid', 'completed')
           AND substr(${effectiveDate}, 1, 7) = strftime('%Y-%m', 'now', 'localtime', '-1 month')
          THEN amount ELSE 0 END
        ), 0) AS previousMonthIncome,
        SUM(CASE
          WHEN status IN ('paid', 'completed')
           AND substr(${effectiveDate}, 1, 7) = strftime('%Y-%m', 'now', 'localtime')
          THEN 1 ELSE 0 END
        ) AS monthOrderCount
      FROM orders
      WHERE date(${effectiveDate}) <= date('now', 'localtime')
    `).get<any>() || {};
    const monthlyRows = db.prepare(`
      SELECT substr(${effectiveDate}, 1, 7) AS month, COALESCE(SUM(amount), 0) AS revenue
      FROM orders
      WHERE status IN ('paid', 'completed')
        AND date(${effectiveDate}) <= date('now', 'localtime')
        AND substr(${effectiveDate}, 1, 7) >= strftime('%Y-%m', 'now', 'localtime', '-11 months')
      GROUP BY substr(${effectiveDate}, 1, 7)
    `).all<{ month: string; revenue: number }>();
    const monthlyMap = new Map(monthlyRows.map(row => [row.month, Number(row.revenue || 0)]));
    const monthly = monthKeys().map(key => ({
      month: `${Number(key.slice(5, 7))}月`,
      revenue: monthlyMap.get(key) || 0,
    }));

    const memberStats = db.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN substr(COALESCE(NULLIF(register_date, ''), created_at), 1, 7)
          = strftime('%Y-%m', 'now', 'localtime') THEN 1 ELSE 0 END) AS newThisMonth,
        SUM(CASE WHEN substr(COALESCE(NULLIF(register_date, ''), created_at), 1, 7)
          = strftime('%Y-%m', 'now', 'localtime', '-1 month') THEN 1 ELSE 0 END) AS previousMonth,
        SUM(CASE WHEN EXISTS (
          SELECT 1 FROM Payment payment
          WHERE payment.memberId = Member.id AND COALESCE(payment.amount, 0) > 0
        ) OR EXISTS (
          SELECT 1 FROM CourseAuthorization authorization
          WHERE authorization.member_id = Member.id AND authorization.status = 'active'
        ) THEN 1 ELSE 0 END) AS active
      FROM Member
      WHERE COALESCE(status, 'active') != 'deleted'
    `).get<any>() || {};
    const levelCounts = db.prepare(`
      SELECT COALESCE(NULLIF(level, ''), '未分级') AS label, COUNT(*) AS count
      FROM Member
      WHERE COALESCE(status, 'active') != 'deleted'
      GROUP BY COALESCE(NULLIF(level, ''), '未分级')
      ORDER BY count DESC
    `).all<{ label: string; count: number }>();
    const cityCounts = db.prepare(`
      SELECT COALESCE(NULLIF(city, ''), NULLIF(province, ''), NULLIF(country, ''), '未填写') AS label,
             COUNT(*) AS count
      FROM Member
      WHERE COALESCE(status, 'active') != 'deleted'
      GROUP BY COALESCE(NULLIF(city, ''), NULLIF(province, ''), NULLIF(country, ''), '未填写')
      ORDER BY count DESC
      LIMIT 8
    `).all<{ label: string; count: number }>();

    const courseStats = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM CourseSeries WHERE status != 'deleted') AS onlineCount,
        (SELECT COUNT(*) FROM Course WHERE status != 'deleted') AS offlineCount,
        (SELECT COUNT(*) FROM CourseAuthorization WHERE status = 'active')
          + (SELECT COUNT(DISTINCT memberId || ':' || courseId) FROM Payment) AS totalEnrollments,
        COALESCE((SELECT AVG(CASE
          WHEN capacity > 0 THEN MIN(100.0, (capacity - MAX(remaining, 0)) * 100.0 / capacity)
          ELSE 0 END)
          FROM Course WHERE status != 'deleted'), 0) AS completionRate
    `).get<any>() || {};
    const hotCourses = db.prepare(`
      SELECT * FROM (
        SELECT CAST(id AS TEXT) AS key, name, '线上' AS type,
               COALESCE(total_students, 0) AS enrollments,
               ROUND(COALESCE(completion_pct, 0)) AS completion,
               0 AS rating
        FROM CourseSeries
        WHERE status != 'deleted'
        UNION ALL
        SELECT 'offline-' || id AS key, name, '线下' AS type,
               CASE WHEN capacity > 0 THEN MAX(capacity - MAX(remaining, 0), 0) ELSE 0 END AS enrollments,
               CASE WHEN capacity > 0 THEN ROUND(MIN(100.0, (capacity - MAX(remaining, 0)) * 100.0 / capacity)) ELSE 0 END AS completion,
               0 AS rating
        FROM Course
        WHERE status != 'deleted'
      )
      ORDER BY enrollments DESC, name
      LIMIT 10
    `).all<any>().map((row, index) => ({ ...row, rank: index + 1 }));

    const byTypeRows = db.prepare(`
      SELECT COALESCE(NULLIF(order_type, ''), '其他') AS label,
             COALESCE(SUM(amount), 0) AS value,
             COUNT(*) AS count
      FROM orders
      WHERE status IN ('paid', 'completed')
        AND date(${effectiveDate}) <= date('now', 'localtime')
      GROUP BY COALESCE(NULLIF(order_type, ''), '其他')
      ORDER BY value DESC
    `).all<{ label: string; value: number; count: number }>();

    const income = Number(orderStats.income || 0);
    const expense = Number(orderStats.expense || 0);
    const profit = income - expense;
    const monthIncome = Number(orderStats.monthIncome || 0);
    const previousMonthIncome = Number(orderStats.previousMonthIncome || 0);
    const monthOrderCount = Number(orderStats.monthOrderCount || 0);
    const totalMembers = Number(memberStats.total || 0);
    const newThisMonth = Number(memberStats.newThisMonth || 0);
    const previousMonthMembers = Number(memberStats.previousMonth || 0);
    const colors = ['#F72A8A', '#7C3AED', '#3B82F6', '#22C55E', '#F59E0B', '#6B7280'];

    return Response.json({
      sales: {
        monthIncome,
        previousMonthIncome,
        growthRate: previousMonthIncome ? percent(monthIncome - previousMonthIncome, previousMonthIncome) : 0,
        orderCount: monthOrderCount,
        averageOrderAmount: monthOrderCount ? Math.round(monthIncome / monthOrderCount) : 0,
        monthly,
      },
      members: {
        total: totalMembers,
        newThisMonth,
        active: Number(memberStats.active || 0),
        churnRate: previousMonthMembers
          ? percent(Math.max(previousMonthMembers - newThisMonth, 0), previousMonthMembers)
          : 0,
        byLevel: levelCounts.map((row, index) => ({
          key: String(index + 1),
          level: row.label,
          count: Number(row.count || 0),
          percent: percent(Number(row.count || 0), totalMembers),
        })),
        byCity: cityCounts.map((row, index) => ({
          key: String(index + 1),
          city: row.label,
          count: Number(row.count || 0),
          percent: percent(Number(row.count || 0), totalMembers),
        })),
      },
      courses: {
        onlineCount: Number(courseStats.onlineCount || 0),
        offlineCount: Number(courseStats.offlineCount || 0),
        totalEnrollments: Number(courseStats.totalEnrollments || 0),
        completionRate: Math.round(Number(courseStats.completionRate || 0)),
        hotCourses,
      },
      finance: {
        income,
        expense,
        profit,
        profitRate: percent(profit, income),
        byType: byTypeRows.map((row, index) => ({
          key: String(index + 1),
          category: row.label,
          amount: Number(row.value || 0),
          percent: percent(Number(row.value || 0), income),
          color: colors[index % colors.length],
        })),
      },
    });
  } finally {
    db.close();
  }
}
