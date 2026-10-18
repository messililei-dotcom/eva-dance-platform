import { getCoursePromotion, courseSalePrice } from '@/lib/server/course-promotion';
import { jsonError, withDb } from '../../_helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const year = Number(url.searchParams.get('year')) || new Date().getFullYear();
    const month = Number(url.searchParams.get('month')) || (new Date().getMonth() + 1);
    
    // 构建月份范围
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

    return withDb((db) => {
      const events: any[] = [];
      const promotionEnabled = getCoursePromotion(db).enabled;

      // 1. 线下培训课程（CourseSession）
      const sessions = db.prepare(`
        SELECT cs.id, cs.sessionNo, ct.name as course_name, cs.startDate, cs.endDate,
               cs.location, cs.teacher, cs.price, cs.maxStudents, cs.currentStudents, cs.status,
               cs.templateId, cs.notes
        FROM CourseSession cs
        LEFT JOIN CourseTemplate ct ON cs.templateId = ct.id
        WHERE cs.startDate >= ? AND cs.startDate < ? AND cs.isActive = 1
        ORDER BY cs.startDate
      `).all(startDate, endDate) as any[];

      sessions.forEach(s => {
        events.push({
          id: `session-${s.id}`,
          type: 'offline',
          title: s.course_name || `课程(${s.sessionNo || s.id})`,
          subtitle: s.notes || '',
          date: s.startDate,
          endDate: s.endDate || '',
          location: s.location || '',
          teacher: s.teacher || '',
          price: s.price || 0,
          status: s.status || 'upcoming',
          enrolled: s.currentStudents || 0,
          maxStudents: s.maxStudents || 0,
        });
      });

      // 2. 线上课程系列已发布
      const series = db.prepare(`
        SELECT cs.id, cs.name, cs.subtitle, cs.teacher, cs.category, cs.price, cs.promo_price,
               cs.created_at, cs.status, cs.source_type
        FROM CourseSeries cs
        WHERE cs.status = 'published' AND cs.created_at >= ? AND cs.created_at < ?
        ORDER BY cs.created_at DESC
      `).all(startDate, endDate) as any[];

      series.forEach(s => {
        const createdDate = String(s.created_at || '').slice(0, 10);
        events.push({
          id: `series-${s.id}`,
          type: 'online',
          title: s.name || '线上课程',
          subtitle: s.subtitle || s.category || '',
          date: createdDate,
          endDate: '',
          location: '线上',
          teacher: s.teacher || '',
          price: courseSalePrice(s, promotionEnabled),
          status: s.status,
          category: s.category || '',
        });
      });

      // 3. 赛事活动
      const competitions = db.prepare(`
        SELECT ec.id, ec.name, ec.start_date, ec.end_date, ec.location, ec.status
        FROM event_competitions ec
        WHERE (ec.start_date >= ? AND ec.start_date < ?)
           OR (ec.end_date >= ? AND ec.end_date < ?)
        ORDER BY ec.start_date
      `).all(startDate, endDate, startDate, endDate) as any[];

      competitions.forEach(c => {
        events.push({
          id: `event-${c.id}`,
          type: 'event',
          title: c.name || '赛事活动',
          subtitle: (c.status === 'active' ? '进行中' : c.status === 'draft' ? '筹备中' : c.status === 'completed' ? '已结束' : '') || '',
          date: String(c.start_date || '').slice(0, 10),
          endDate: String(c.end_date || '').slice(0, 10),
          location: c.location || '',
          teacher: '',
          price: 0,
          status: c.status || '',
        });
      });

      // 排序：按日期排序
      events.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

      // 按天聚合
      const byDate: Record<string, any[]> = {};
      events.forEach(e => {
        const key = e.date;
        if (!byDate[key]) byDate[key] = [];
        byDate[key].push(e);
      });

      return Response.json({
        success: true,
        data: {
          year,
          month,
          total: events.length,
          events,
          byDate,
        },
      });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
