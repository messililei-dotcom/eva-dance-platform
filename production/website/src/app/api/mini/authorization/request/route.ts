import { getMemberId, jsonError, toPositiveInt, withDb } from '../../_helpers';
import { courses as websiteCourses } from '@/config/courses';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function ensureCourseSeriesVisitTable(db: any) {
  db.prepare(`CREATE TABLE IF NOT EXISTS CourseSeriesVisit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL,
    series_id INTEGER NOT NULL,
    source TEXT DEFAULT 'learn',
    first_visited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_visited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    visit_count INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(member_id, series_id)
  )`).run();
  db.exec('CREATE INDEX IF NOT EXISTS idx_course_series_visit_series ON CourseSeriesVisit(series_id, first_visited_at)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_course_series_visit_member ON CourseSeriesVisit(member_id, last_visited_at)');
}

function recordAuthorizationRequest(db: any, seriesId: number, memberId: number) {
  ensureCourseSeriesVisitTable(db);
  db.prepare(
    `INSERT INTO CourseSeriesVisit (member_id, series_id, source, first_visited_at, last_visited_at, visit_count)
     VALUES (?, ?, 'auth_request', datetime('now','localtime'), datetime('now','localtime'), 1)
     ON CONFLICT(member_id, series_id) DO UPDATE SET
       last_visited_at=excluded.last_visited_at,
       source='auth_request',
       visit_count=CourseSeriesVisit.visit_count + 1`
  ).run(memberId, seriesId);
}

function normalizeSeriesName(value?: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/成品舞/g, '')
    .replace(/[｜|·•・.\s"'“”‘’《》（）()【】\[\]：:，,。！!、\-—_]/g, '');
}

function resolveSeriesId(db: any, rawSeriesId: unknown) {
  const routeId = String(rawSeriesId || '');
  const exactId = toPositiveInt(rawSeriesId);
  if (exactId) {
    const exact = db.prepare('SELECT id FROM CourseSeries WHERE id=? AND status=?').get(exactId, 'published');
    if (exact) return exactId;
  }

  const websiteCourse = websiteCourses.find(course => course.id === routeId);
  const targetName = normalizeSeriesName(websiteCourse?.title);
  if (targetName) {
    const seriesRows = db.prepare('SELECT id, name FROM CourseSeries WHERE status=?').all('published');
    const match = seriesRows.find((row: any) => {
      const name = normalizeSeriesName(row.name);
      return name && (name === targetName || name.includes(targetName) || targetName.includes(name));
    });
    if (match?.id) return Number(match.id);
  }
  return toPositiveInt(rawSeriesId);
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    return withDb((db) => {
      const memberId = getMemberId(new URL(request.url).searchParams, request);
      if (!memberId) return jsonError('未登录', 401);

      const seriesId = resolveSeriesId(db, body.series_id);
      if (!seriesId) return jsonError('请选择要申请授权的课程', 400);

      const series = db.prepare('SELECT id, name FROM CourseSeries WHERE id=?').get<{ id: number; name: string }>(seriesId);
      if (!series) return jsonError('课程不存在', 404);

      recordAuthorizationRequest(db, seriesId, memberId);
      const visit = db.prepare(
        `SELECT first_visited_at, last_visited_at, visit_count, source
         FROM CourseSeriesVisit
         WHERE member_id=? AND series_id=?`
      ).get(memberId, seriesId);

      return Response.json({
        success: true,
        message: '授权申请已提交，请等待老师开通课程权限',
        data: {
          series_id: series.id,
          series_name: series.name,
          member_id: memberId,
          ...(visit || {}),
        },
      });
    });
  } catch (err: any) {
    return jsonError(err?.message || '授权申请提交失败');
  }
}
