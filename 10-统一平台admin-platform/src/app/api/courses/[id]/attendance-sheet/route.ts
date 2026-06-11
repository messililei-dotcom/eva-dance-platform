import { cleanText, hasAuth, nowIso, openTrainingDb, unauthorized } from '../../../training-db';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const sheet = body.sheet || {};
  const db = openTrainingDb();
  try {
    const result = db.prepare(`
      UPDATE Course
      SET attendanceSheetPath = ?, attendanceSheetFilename = ?, attendanceSheetUploadedAt = ?
      WHERE id = ?
    `).run(cleanText(sheet.data), cleanText(sheet.name, '签到表照片'), nowIso(), routeParams.id);
    if (!result.changes) return Response.json({ success: false, error: '课程不存在' }, { status: 404 });
    return Response.json({ success: true });
  } finally {
    db.close();
  }
}
