import { cleanText, getAuthenticatedMemberId, jsonError, toPositiveInt, withDb } from '../_helpers';

export async function GET(request: Request) {
  try {
    return withDb((db) => {
      const url = new URL(request.url);
      const memberId = getAuthenticatedMemberId(request, url.searchParams);
      const videoId = toPositiveInt(url.searchParams.get('video_id'));
      if (!memberId) return jsonError('未登录', 401);
      if (!videoId) return jsonError('视频ID不能为空', 400);
      const data = db.prepare('SELECT * FROM StudyNote WHERE member_id=? AND video_id=? ORDER BY timestamp_seconds, created_at DESC').all(memberId, videoId);
      return Response.json({ success: true, data });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return withDb((db) => {
      const memberId = getAuthenticatedMemberId(request, new URL(request.url).searchParams);
      const videoId = toPositiveInt(body.video_id);
      const content = cleanText(body.content);
      if (!memberId) return jsonError('未登录', 401);
      if (!videoId) return jsonError('视频ID不能为空', 400);
      if (!content) return jsonError('笔记内容不能为空', 400);
      const result = db.prepare('INSERT INTO StudyNote (member_id, video_id, timestamp_seconds, content) VALUES (?, ?, ?, ?)').run(memberId, videoId, Math.max(0, Number(body.timestamp_seconds || 0)), content);
      return Response.json({ success: true, data: { id: result.lastInsertRowid } });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
