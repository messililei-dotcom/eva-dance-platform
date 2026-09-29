import { hasAuth, openTrainingDb, unauthorized } from '../../training-db';

export const dynamic = 'force-dynamic';

function percent(value: number, total: number) {
  return total ? Math.round((value / total) * 1000) / 10 : 0;
}

export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const db = openTrainingDb();
  try {
    const now = new Date();
    const monthKeys = Array.from({ length: 12 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1);
      return date.toISOString().slice(0, 7);
    });
    const currentMonth = monthKeys[11];
    const previousMonth = monthKeys[10];
    const monthlyRows = db.prepare(`
      SELECT substr(COALESCE(NULLIF(paid_at, ''), created_at), 1, 7) AS month,
             SUM(amount) AS revenue, COUNT(*) AS count
      FROM orders
      WHERE status IN ('paid', 'completed') AND substr(COALESCE(NULLIF(paid_at, ''), created_at), 1, 7) >= ?
      GROUP BY month
    `).all<any>(monthKeys[0]);
    const monthlyMap = new Map(monthlyRows.map(row => [row.month, row]));
    const monthly = monthKeys.map(key => ({ month: `${Number(key.slice(5, 7))}月`, revenue: Number(monthlyMap.get(key)?.revenue || 0) }));
    const monthIncome = Number(monthlyMap.get(currentMonth)?.revenue || 0);
    const previousMonthIncome = Number(monthlyMap.get(previousMonth)?.revenue || 0);
    const monthOrderCount = Number(monthlyMap.get(currentMonth)?.count || 0);

    const memberTotal = Number(db.prepare("SELECT COUNT(*) AS count FROM Member WHERE COALESCE(status, 'active') != 'deleted'").get<any>()?.count || 0);
    const newThisMonth = Number(db.prepare("SELECT COUNT(*) AS count FROM Member WHERE COALESCE(status, 'active') != 'deleted' AND substr(COALESCE(register_date, created_at),1,7)=?").get<any>(currentMonth)?.count || 0);
    const previousMonthMembers = Number(db.prepare("SELECT COUNT(*) AS count FROM Member WHERE COALESCE(status, 'active') != 'deleted' AND substr(COALESCE(register_date, created_at),1,7)=?").get<any>(previousMonth)?.count || 0);
    const activeMembers = Number(db.prepare(`
      SELECT COUNT(*) AS count FROM Member m
      WHERE COALESCE(m.status, 'active') != 'deleted'
        AND (EXISTS (SELECT 1 FROM Payment p WHERE p.memberId=m.id) OR EXISTS (SELECT 1 FROM CourseAuthorization ca WHERE ca.member_id=m.id AND ca.status='active'))
    `).get<any>()?.count || 0);
    const levelData = db.prepare("SELECT COALESCE(NULLIF(level,''),'未分级') AS label, COUNT(*) AS count FROM Member WHERE COALESCE(status,'active')!='deleted' GROUP BY label ORDER BY count DESC").all<any>();
    const cityData = db.prepare("SELECT COALESCE(NULLIF(city,''), NULLIF(country,''), '未填写') AS label, COUNT(*) AS count FROM Member WHERE COALESCE(status,'active')!='deleted' GROUP BY label ORDER BY count DESC LIMIT 8").all<any>();

    const onlineCount = Number(db.prepare('SELECT COUNT(*) AS count FROM CourseSeries').get<any>()?.count || 0);
    const offlineCount = Number(db.prepare("SELECT COUNT(*) AS count FROM Course WHERE series_id IS NULL OR series_id=0").get<any>()?.count || 0);
    const hotCourses = db.prepare(`
      SELECT key, name, type, enrollments, completion FROM (
        SELECT 'online-' || cs.id AS key, cs.name, '线上' AS type,
               COUNT(DISTINCT ca.member_id) AS enrollments, 0 AS completion
        FROM CourseSeries cs LEFT JOIN CourseAuthorization ca ON ca.series_id=cs.id AND ca.status='active'
        GROUP BY cs.id
        UNION ALL
        SELECT 'offline-' || c.id, c.name, '线下', COUNT(DISTINCT p.memberId),
               CASE WHEN COALESCE(c.capacity,0)>0 THEN MIN(100, ROUND(COUNT(DISTINCT p.memberId)*100.0/c.capacity)) ELSE 0 END
        FROM Course c LEFT JOIN Payment p ON p.courseId=c.id
        WHERE c.series_id IS NULL OR c.series_id=0
        GROUP BY c.id
      ) ORDER BY enrollments DESC LIMIT 10
    `).all<any>().map((row, index) => ({ ...row, rank: index + 1, rating: 0, enrollments: Number(row.enrollments || 0), completion: Number(row.completion || 0) }));
    const totalEnrollments = hotCourses.reduce((sum, row) => sum + row.enrollments, 0);

    const financeRows = db.prepare(`
      SELECT COALESCE(NULLIF(order_type,''),'其他') AS category, SUM(amount) AS amount, COUNT(*) AS count
      FROM orders WHERE status IN ('paid','completed') GROUP BY category ORDER BY amount DESC
    `).all<any>();
    const income = financeRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const refunds = Number(db.prepare("SELECT COALESCE(SUM(amount),0) AS amount FROM orders WHERE status='refunded'").get<any>()?.amount || 0);
    const colors = ['#F72A8A', '#7C3AED', '#3B82F6', '#22C55E', '#F59E0B', '#6B7280'];

    return Response.json({ data: {
      sales: { monthIncome, previousMonthIncome, growthRate: previousMonthIncome ? percent(monthIncome - previousMonthIncome, previousMonthIncome) : 0, orderCount: monthOrderCount, averageOrderAmount: monthOrderCount ? Math.round(monthIncome / monthOrderCount) : 0, monthly },
      members: { total: memberTotal, newThisMonth, active: activeMembers, churnRate: previousMonthMembers ? percent(Math.max(previousMonthMembers - newThisMonth, 0), previousMonthMembers) : 0, byLevel: levelData.map((row, index) => ({ key: String(index + 1), level: row.label, count: row.count, percent: percent(row.count, memberTotal) })), byCity: cityData.map((row, index) => ({ key: String(index + 1), city: row.label, count: row.count, percent: percent(row.count, memberTotal) })) },
      courses: { onlineCount, offlineCount, totalEnrollments, completionRate: hotCourses.length ? Math.round(hotCourses.reduce((sum, row) => sum + row.completion, 0) / hotCourses.length) : 0, hotCourses },
      finance: { income, expense: refunds, profit: income - refunds, profitRate: income ? percent(income - refunds, income) : 0, byType: financeRows.map((row, index) => ({ key: String(index + 1), category: row.category, amount: Number(row.amount || 0), percent: percent(Number(row.amount || 0), income), color: colors[index % colors.length] })) },
    } });
  } finally {
    db.close();
  }
}
