import { cleanText, getMemberId, jsonError, toPositiveInt, withDb } from '../../../_helpers';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  try {
    const body = await request.json();
    return withDb((db) => {
      const questionId = toPositiveInt(routeParams.id);
      const memberId = getMemberId(new URL(request.url).searchParams, request);
      const content = cleanText(body.content);
      if (!memberId) return jsonError('未登录', 401);
      if (!content) return jsonError('回答内容不能为空', 400);
      if (!db.prepare('SELECT id FROM Question WHERE id=?').get(questionId)) return jsonError('问题不存在', 404);
      const result = db.prepare('INSERT INTO Answer (question_id, member_id, content, is_teacher) VALUES (?, ?, ?, ?)').run(questionId, memberId, content, body.is_teacher ? 1 : 0);
      db.prepare("UPDATE Question SET status='answered', updated_at=datetime('now','localtime') WHERE id=?").run(questionId);
      return Response.json({ success: true, data: { id: result.lastInsertRowid } });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
