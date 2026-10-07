import { getMemberId } from '@/app/api/mini/_helpers';
import { openAdminDb } from '@/lib/server/admin-db';
import { loadJudgeGroups, loadJudgePlayers, loadJudgeCriteria, loadCurrentJudgeScore, resolveJudge, saveJudgeScore, verifyJudgeGroup } from '@/lib/server/event-judge';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
async function handle(request: Request, params: Promise<{ id: string }>, write: boolean) {
  const memberId = getMemberId(new URLSearchParams(), request);
  const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
  if (!memberId) return reply({ success: false, error: '请先登录' }, 401);
  const competitionId = Number((await params).id);
  if (!Number.isSafeInteger(competitionId) || competitionId <= 0) return reply({ success: false, error: '赛事不存在' }, 404);
  const url = new URL(request.url), groupId = Number(url.searchParams.get('groupId')), playerId = Number(url.searchParams.get('playerId'));
  const db = openAdminDb({ readonly: !write });
  try {
    const competition = db.prepare("SELECT id, name FROM event_competitions WHERE id=? AND status='published'").get(competitionId);
    if (!competition) return reply({ success: false, error: '赛事不存在' }, 404);
    const judge = resolveJudge(db, memberId, competitionId);
    if (!judge) return reply({ success: false, error: '您尚未获得本赛事评委授权' }, 403);
    if (!url.searchParams.has('groupId') && !write) return reply({ success: true, data: { competition, judge, groups: loadJudgeGroups(db, competitionId, judge.id) } });
    if (!Number.isSafeInteger(groupId) || groupId <= 0) return reply({ success: false, error: '组别不存在' }, 404);
    const group = verifyJudgeGroup(db, competitionId, groupId, judge.id);
    if (!group) return reply({ success: false, error: '无此组别评委权限' }, 403);
    const players = loadJudgePlayers(db, competitionId, groupId, judge.id);
    if (!url.searchParams.has('playerId') && !write) return reply({ success: true, data: { competition, judge, group, players } });
    const player = players.find(p => p.id === playerId);
    if (!player) return reply({ success: false, error: '选手不存在或未审核通过' }, 404);
    const criteria = loadJudgeCriteria(db, competitionId, group);
    if (write) {
      const body = await request.json().catch(() => ({}));
      const result = saveJudgeScore(db, { competitionId, group, playerId, judge, criteria, values: body.scores || {} });
      return reply({ success: true, data: result, message: '评分已提交' });
    }
    return reply({ success: true, data: { competition, judge, group, player, criteria, currentScore: loadCurrentJudgeScore(db, groupId, playerId, judge.id, criteria) } });
  } catch (error) {
    return reply({ success: false, error: write && error instanceof Error ? error.message : '评分页面加载失败' }, write ? 400 : 500);
  } finally { db.close(); }
}
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) { return handle(request, params, false); }
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) { return handle(request, params, true); }
