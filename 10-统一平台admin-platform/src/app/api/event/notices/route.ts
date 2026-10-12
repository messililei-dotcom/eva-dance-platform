import { hasAuth, unauthorized, jsonError, readEventBody, toNumber, withRequestEventDb } from '../_db';
import { eventNoticeAudience, publishEventNotice } from '@/lib/server/event-notices';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const competitionId = toNumber(new URL(request.url).searchParams.get('competitionId'));
  if (!Number.isSafeInteger(competitionId) || competitionId <= 0) return jsonError('缺少赛事ID',400);
  return withRequestEventDb(request, db => {
    try {
      const { memberIds, competition, ...audience } = eventNoticeAudience(db, competitionId);
      return Response.json({ success:true, data: audience });
    } catch (error: any) { return jsonError(error?.message || '赛事不存在',404); }
  });
}
export async function POST(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const body = await readEventBody(request);
  const competitionId = toNumber(body.competitionId), title = String(body.title || '').trim(), content = String(body.content || '').trim(), requestKey = String(body.requestKey || '');
  if (!Number.isSafeInteger(competitionId) || competitionId <= 0 || !title || title.length > 60 || !content || content.length > 2000 || !/^[a-zA-Z0-9-]{16,80}$/.test(requestKey)) return jsonError('请填写有效的赛事、通知标题和内容',400);
  return withRequestEventDb(request, db => {
    try { return Response.json({success:true,data:publishEventNotice(db,competitionId,{title,content,requestKey})}); }
    catch (error: any) { return jsonError(error?.message || '通知发送失败',400); }
  });
}
