import { jsonError, toPositiveInt, withDb } from '../../_helpers';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  try {
    return withDb((db) => {
      const id = toPositiveInt(routeParams.id);
      const question = db.prepare(
        `SELECT q.*, m.name as member_name, m.phone as member_phone
         FROM Question q JOIN Member m ON q.member_id=m.id WHERE q.id=?`
      ).get(id);
      if (!question) return jsonError('问题不存在', 404);
      const answers = db.prepare(
        `SELECT a.*, m.name as member_name, m.phone as member_phone
         FROM Answer a JOIN Member m ON a.member_id=m.id
         WHERE a.question_id=? ORDER BY a.created_at ASC`
      ).all(id);
      return Response.json({ success: true, data: { ...question, answers } });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
