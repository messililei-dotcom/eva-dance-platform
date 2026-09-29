import { cleanText, hasAuth, openTrainingDb, syncMemberDenormalizedFields, today, unauthorized } from '../training-db';
import { recalculateMemberGrowth } from '@/lib/server/student-growth';
import { createWelcomeMessage } from '@/lib/server/inbox';
import { normalizeMemberPhone, normalizedMemberPhoneSql } from '@/lib/member-phone-search';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const db = openTrainingDb();
  try {
    const directoryView = new URL(request.url).searchParams.get('view') === 'directory';
    if (directoryView) {
      db.exec('CREATE INDEX IF NOT EXISTS idx_member_name ON Member(name)');
      const hasFinanceIncome = Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='FinanceIncome'").get());
      const onlineIncomeCte = hasFinanceIncome ? `
        online_income_rows AS (
          SELECT NULLIF(memberId, 0) AS member_id,
                 amount,
                 COALESCE(NULLIF(income_date, ''), created_at) AS activity_at
          FROM FinanceIncome
          WHERE category LIKE '%线上课程%'
        ),
        online_income_metrics AS (
          SELECT member_id, SUM(amount) AS amount, MAX(activity_at) AS last_active_at
          FROM online_income_rows
          WHERE member_id IS NOT NULL
          GROUP BY member_id
        ),` : `
        online_income_metrics AS (
          SELECT NULL AS member_id, 0 AS amount, NULL AS last_active_at WHERE 0
        ),`;
      const rows = db.prepare(`
        WITH order_rows AS (
          SELECT COALESCE(
                   NULLIF(member_id, 0),
                   (SELECT m0.id FROM Member m0
                    WHERE COALESCE(orders.member_phone, '') <> '' AND orders.member_phone = m0.phone
                    ORDER BY m0.id DESC LIMIT 1),
                   (SELECT m0.id FROM Member m0
                    WHERE COALESCE(orders.member_name, '') <> '' AND orders.member_name = m0.name
                    ORDER BY m0.id DESC LIMIT 1)
                 ) AS resolved_member_id,
                 amount,
                 COALESCE(NULLIF(paid_at, ''), created_at) AS activity_at
          FROM orders
        ),
        order_metrics AS (
          SELECT resolved_member_id AS member_id, SUM(amount) AS amount, MAX(activity_at) AS last_active_at
          FROM order_rows
          WHERE resolved_member_id IS NOT NULL
          GROUP BY resolved_member_id
        ),
        ${onlineIncomeCte}
        offline_counts AS (
          SELECT memberId AS member_id, COUNT(DISTINCT courseId) AS course_count
          FROM Payment GROUP BY memberId
        ),
        online_counts AS (
          SELECT member_id, COUNT(DISTINCT series_id) AS course_count
          FROM CourseAuthorization
          WHERE status = 'active'
          GROUP BY member_id
        )
        SELECT Member.id, Member.name, Member.phone, Member.gender, Member.birthday,
               Member.level, Member.remark, Member.register_date, Member.created_at,
               Member.province, Member.city, Member.address, Member.country,
               Member.foreignRegion, Member.status, Member.source, Member.remaining_hours,
               Member.wx_openid, Member.wx_unionid, Member.avatar,
               COALESCE(order_metrics.amount, 0) + COALESCE(online_income_metrics.amount, 0) AS totalSpent,
               COALESCE(offline_counts.course_count, 0) + COALESCE(online_counts.course_count, 0) AS courseCount,
               MAX(COALESCE(order_metrics.last_active_at, ''), COALESCE(online_income_metrics.last_active_at, ''), COALESCE(Member.register_date, ''), COALESCE(Member.created_at, '')) AS lastActiveAt
        FROM Member
        LEFT JOIN order_metrics ON order_metrics.member_id = Member.id
        LEFT JOIN online_income_metrics ON online_income_metrics.member_id = Member.id
        LEFT JOIN offline_counts ON offline_counts.member_id = Member.id
        LEFT JOIN online_counts ON online_counts.member_id = Member.id
        WHERE COALESCE(Member.status, 'active') != 'deleted'
        ORDER BY datetime(Member.created_at) DESC, Member.id DESC
      `).all();
      const orderRevenue = Number(db.prepare('SELECT COALESCE(SUM(amount), 0) AS total FROM orders').get<any>()?.total || 0);
      return Response.json({ data: rows, summary: { orderRevenue } });
    }

    const rows = db.prepare(`
      SELECT
        Member.*,
        COALESCE(StudentGrowthSummary.experience_total, 0) AS experience_total,
        COALESCE(StudentGrowthSummary.level_no, 1) AS level_no,
        COALESCE(StudentGrowthSummary.level_name, '初舞学员') AS level_name,
        StudentGrowthSummary.academy_started_at,
        StudentGrowthSummary.academy_started_source,
        COALESCE(StudentGrowthSummary.online_authorized_courses, 0) AS online_authorized_courses,
        COALESCE(StudentGrowthSummary.total_learning_days, 0) AS total_learning_days,
        COALESCE(StudentGrowthSummary.current_streak_days, 0) AS current_streak_days,
        COALESCE(SUM(Payment.amount), 0) AS totalSpent,
        COUNT(DISTINCT Payment.courseId) AS courseCount,
        MAX(COALESCE(NULLIF(Payment.date, ''), Payment.created_at)) AS lastActiveAt
      FROM Member
      LEFT JOIN Payment ON Payment.memberId = Member.id
      LEFT JOIN StudentGrowthSummary ON StudentGrowthSummary.user_id = Member.id
      WHERE COALESCE(Member.status, 'active') != 'deleted'
      GROUP BY Member.id
      ORDER BY datetime(Member.created_at) DESC, Member.id DESC
    `).all();
    return Response.json(rows);
  } finally {
    db.close();
  }
}

export async function POST(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const name = cleanText(body.name);
  if (!name) return Response.json({ success: false, error: '请填写学员姓名' }, { status: 400 });
  const phone = cleanText(body.phone);

  const db = openTrainingDb();
  try {
    if (phone) {
      const normalizedPhone = normalizeMemberPhone(phone);
      const phoneSql = normalizedMemberPhoneSql('phone');
      const nationalPhoneSql = normalizedMemberPhoneSql('phone_national_number');
      const existing = db.prepare(`
        SELECT id, name, COALESCE(NULLIF(phone, ''), phone_national_number, '') AS phone
        FROM Member
        WHERE COALESCE(status, 'active') != 'deleted'
          AND (${phoneSql} = ? OR ${nationalPhoneSql} = ?)
        LIMIT 1
      `).get(normalizedPhone, normalizedPhone);
      if (existing) {
        return Response.json({
          success: false,
          error: '手机号已被其他学员使用',
          existingMember: existing,
        }, { status: 409 });
      }
    }

    const result = db.prepare(`
      INSERT INTO Member (
        name, phone, gender, birthday, level, register_date, country, province,
        city, foreignRegion, address, remark, avatar, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `).run(
      name,
      phone,
      cleanText(body.gender, '女'),
      cleanText(body.birthday),
      '初舞学员 Lv.1',
      cleanText(body.register_date ?? body.registerDate, today()),
      cleanText(body.country, '中国'),
      cleanText(body.province),
      cleanText(body.city),
      cleanText(body.foreignRegion),
      cleanText(body.address),
      cleanText(body.remark),
      cleanText(body.avatar),
    );
    syncMemberDenormalizedFields(db, result.lastInsertRowid);
    recalculateMemberGrowth(db, Number(result.lastInsertRowid), '新建学员初始化');
    createWelcomeMessage(db, Number(result.lastInsertRowid), name);
    return Response.json({ success: true, id: result.lastInsertRowid });
  } finally {
    db.close();
  }
}
