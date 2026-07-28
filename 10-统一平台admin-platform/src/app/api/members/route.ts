import { cleanText, hasAuth, openTrainingDb, syncMemberDenormalizedFields, today, unauthorized } from '../training-db';
import { createWelcomeMessage } from '@/lib/server/inbox';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const db = openTrainingDb();
  try {
    const rows = db.prepare(`
      SELECT
        Member.*,
        COALESCE(SUM(Payment.amount), 0) AS totalSpent,
        COUNT(DISTINCT Payment.courseId) AS courseCount,
        MAX(COALESCE(NULLIF(Payment.date, ''), Payment.created_at)) AS lastActiveAt
      FROM Member
      LEFT JOIN Payment ON Payment.memberId = Member.id
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
      const existing = db.prepare(`
        SELECT id
        FROM Member
        WHERE phone = ? AND COALESCE(status, 'active') != 'deleted'
        LIMIT 1
      `).get(phone);
      if (existing) {
        return Response.json({ success: false, error: '手机号已被其他学员使用' }, { status: 400 });
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
      cleanText(body.level, '普通学员'),
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
    createWelcomeMessage(db, Number(result.lastInsertRowid), name);
    return Response.json({ success: true, id: result.lastInsertRowid });
  } finally {
    db.close();
  }
}
