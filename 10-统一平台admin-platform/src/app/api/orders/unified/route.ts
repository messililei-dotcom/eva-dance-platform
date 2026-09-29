import { hasAuth, openTrainingDb, unauthorized } from '../../training-db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const db = openTrainingDb();
  try {
    const url = new URL(request.url);
    const paged = url.searchParams.get('paged') === '1';
    const financeSummary = url.searchParams.get('financeSummary') === '1';
    if (financeSummary) {
      const effectiveDateSql = "COALESCE(NULLIF(paid_at, ''), created_at)";
      const asOfTodaySql = `date(${effectiveDateSql}) <= date('now', 'localtime')`;
      const nowMonth = db.prepare("SELECT strftime('%Y-%m', 'now', 'localtime') AS month").get<any>()?.month || '';
      const stats = db.prepare(`
        SELECT COALESCE(SUM(CASE WHEN status IN ('paid','completed') THEN amount ELSE 0 END),0) AS income,
               COALESCE(SUM(CASE WHEN status='refunded' THEN amount ELSE 0 END),0) AS refunds,
               COALESCE(SUM(CASE WHEN status='refunded' AND substr(${effectiveDateSql},1,4)=strftime('%Y','now','localtime') THEN amount ELSE 0 END),0) AS yearRefunds,
               COALESCE(SUM(CASE WHEN status='refunded' AND substr(${effectiveDateSql},1,7)=? THEN amount ELSE 0 END),0) AS monthRefunds,
               SUM(CASE WHEN status IN ('paid','completed') THEN 1 ELSE 0 END) AS orderCount,
               COALESCE(SUM(CASE WHEN status IN ('paid','completed') AND substr(${effectiveDateSql},1,7)=? THEN amount ELSE 0 END),0) AS monthIncome
        FROM orders
        WHERE ${asOfTodaySql}
      `).get<any>(nowMonth, nowMonth) || {};
      const byType = db.prepare(`
        SELECT COALESCE(NULLIF(order_type,''),'其他') AS label, SUM(amount) AS value, COUNT(*) AS count
        FROM orders
        WHERE status IN ('paid','completed') AND ${asOfTodaySql}
        GROUP BY label ORDER BY value DESC
      `).all();
      const income = Number(stats.income || 0);
      const refunds = Number(stats.refunds || 0);
      const orderCount = Number(stats.orderCount || 0);
      return Response.json({
        income,
        expense: refunds,
        profit: income - refunds,
        orderCount,
        averageOrderAmount: orderCount ? Math.round(income / orderCount) : 0,
        monthIncome: Number(stats.monthIncome || 0),
        refunds,
        yearRefunds: Number(stats.yearRefunds || 0),
        monthRefunds: Number(stats.monthRefunds || 0),
        byType,
        recentOrders: [],
      });
    }
    if (paged) {
      const page = Math.max(1, Number(url.searchParams.get('page') || 1));
      const pageSize = Math.min(100, Math.max(10, Number(url.searchParams.get('pageSize') || 20)));
      const keyword = String(url.searchParams.get('keyword') || '').trim();
      const type = String(url.searchParams.get('type') || 'all');
      const status = String(url.searchParams.get('status') || 'all');
      const where: string[] = [];
      const values: unknown[] = [];
      if (keyword) {
        where.push('(orders.order_no LIKE ? OR orders.member_name LIKE ? OR orders.member_phone LIKE ? OR orders.title LIKE ?)');
        const like = `%${keyword}%`;
        values.push(like, like, like, like);
      }
      if (type !== 'all') { where.push('orders.order_type = ?'); values.push(type); }
      if (status !== 'all') { where.push('orders.status = ?'); values.push(status); }
      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const summary = db.prepare(`
        SELECT COUNT(*) AS total,
               COALESCE(SUM(amount), 0) AS totalAmount,
               SUM(CASE WHEN status IN ('paid', 'completed') THEN 1 ELSE 0 END) AS completed,
               SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
               SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS paid,
               SUM(CASE WHEN status = 'refunded' THEN 1 ELSE 0 END) AS refunded
        FROM orders ${whereSql}
      `).get<any>(...values) || {};
      const types = db.prepare("SELECT DISTINCT order_type FROM orders WHERE COALESCE(order_type, '') <> '' ORDER BY order_type").all<any>().map(row => row.order_type);
      const data = db.prepare(`
        SELECT orders.id, orders.order_no AS orderNo, orders.member_id AS memberId,
               orders.member_name AS memberName, orders.member_phone AS memberPhone,
               orders.order_type AS orderType, orders.source_type AS sourceType,
               orders.source_id AS sourceId, orders.title, orders.amount, orders.status,
               orders.pay_method AS payMethod,
               COALESCE(NULLIF(orders.paid_at, ''), orders.created_at) AS orderDate,
               COALESCE((SELECT ca.granted_at FROM CourseAuthorization ca
                         JOIN CourseOrder co ON co.id = ca.order_id
                         WHERE orders.source_type IN ('online-course', 'online_course', 'course-order')
                           AND (CAST(co.id AS TEXT) = orders.source_id OR co.order_no = orders.order_no)
                         ORDER BY ca.id DESC LIMIT 1), '') AS authorizationDate,
               orders.remark
        FROM orders ${whereSql}
        ORDER BY datetime(COALESCE(NULLIF(orders.paid_at, ''), orders.created_at)) DESC, orders.id DESC
        LIMIT ? OFFSET ?
      `).all(...values, pageSize, (page - 1) * pageSize);
      return Response.json({ data, total: Number(summary.total || 0), page, pageSize, summary, types });
    }

    const rows = db.prepare(`
      SELECT
        orders.id,
        orders.order_no AS orderNo,
        orders.member_id AS memberId,
        orders.member_name AS memberName,
        orders.member_phone AS memberPhone,
        orders.order_type AS orderType,
        orders.source_type AS sourceType,
        orders.source_id AS sourceId,
        orders.title,
        orders.amount,
        orders.status,
        orders.pay_method AS payMethod,
        COALESCE(NULLIF(orders.paid_at, ''), orders.created_at) AS orderDate,
        COALESCE(NULLIF(CourseAuthorization.granted_at, ''), '') AS authorizationDate,
        orders.remark,
        COALESCE(NULLIF(Course.subType, ''), '') AS courseSubType,
        COALESCE(NULLIF(Course.startDate, ''), '') AS courseStartDate,
        COALESCE(NULLIF(Course.endDate, ''), '') AS courseEndDate,
        COALESCE(NULLIF(Payment.sales, ''), '') AS sales,
        COALESCE(NULLIF(Payment.expireDate, ''), '') AS expireDate,
        COALESCE(Payment.remainingSessions, 0) AS remainingSessions,
        orders.created_at,
        orders.updated_at
      FROM orders
      LEFT JOIN Payment
        ON orders.source_type = 'offline-training'
       AND CAST(Payment.id AS TEXT) = orders.source_id
      LEFT JOIN Course
        ON Course.id = Payment.courseId
      LEFT JOIN CourseOrder
        ON orders.source_type IN ('online-course', 'online_course', 'course-order')
       AND (CAST(CourseOrder.id AS TEXT) = orders.source_id OR CourseOrder.order_no = orders.order_no)
      LEFT JOIN CourseAuthorization
        ON CourseAuthorization.order_id = CourseOrder.id
      ORDER BY datetime(COALESCE(NULLIF(orders.paid_at, ''), orders.created_at)) DESC, orders.id DESC
    `).all();
    return Response.json(rows);
  } finally {
    db.close();
  }
}
