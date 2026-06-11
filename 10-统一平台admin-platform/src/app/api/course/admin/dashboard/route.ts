import { openAdminDb } from '@/lib/server/admin-db';

export const dynamic = 'force-dynamic';

type CountRow = { count: number };
type SumRow = { total: number };

export async function GET() {
  const db = openAdminDb({ readonly: true });
  try {
    const series = db.prepare('SELECT COUNT(*) AS count FROM CourseSeries').get<CountRow>()?.count || 0;
    const courses = db.prepare('SELECT COUNT(*) AS count FROM OnlineCourse').get<CountRow>()?.count || 0;
    const materials = db.prepare('SELECT COUNT(*) AS count FROM Material').get<CountRow>()?.count || 0;
    const students = db.prepare('SELECT COUNT(DISTINCT member_id) AS count FROM CourseAuthorization WHERE status = ?').get<CountRow>('active')?.count || 0;
    const orders = db.prepare('SELECT COUNT(*) AS count FROM CourseOrder').get<CountRow>()?.count || 0;
    const revenue = db.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM CourseOrder WHERE status = 'paid'").get<SumRow>()?.total || 0;

    return Response.json({
      data: {
        seriesCount: series,
        courseCount: courses,
        materialCount: materials,
        studentCount: students,
        orderCount: orders,
        revenue,
      },
    });
  } finally {
    db.close();
  }
}
