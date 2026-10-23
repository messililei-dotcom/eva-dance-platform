import { NextResponse } from 'next/server';
import { getAuthenticatedMemberId } from '@/app/api/mini/_helpers';
import { getEventCompetitionId, getEventNewsBySlug } from '@/lib/events-news';
import { openAdminDb } from '@/lib/server/admin-db';
import {
  loadCurrentJudgeScore,
  loadJudgeCriteria,
  resolveJudge,
  saveJudgeScore,
  verifyJudgeGroup,
} from '@/lib/server/event-judge';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Context = { params: Promise<{ slug: string; groupId: string; playerId: string }> };

function contextValues(slug: string, rawGroupId: string, rawPlayerId: string) {
  const event = getEventNewsBySlug(slug);
  return {
    event,
    competitionId: event ? getEventCompetitionId(event) : null,
    groupId: Number(rawGroupId),
    playerId: Number(rawPlayerId),
  };
}

export async function GET(request: Request, { params }: Context) {
  const memberId = getAuthenticatedMemberId(request);
  if (!memberId) return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
  const { slug, groupId: rawGroupId, playerId: rawPlayerId } = await params;
  const { event, competitionId, groupId, playerId } = contextValues(slug, rawGroupId, rawPlayerId);
  if (!event || !competitionId || !Number.isInteger(groupId) || !Number.isInteger(playerId)) {
    return NextResponse.json({ success: false, error: '页面不存在' }, { status: 404 });
  }
  const db = openAdminDb({ readonly: true });
  try {
    const judge = resolveJudge(db, memberId, competitionId);
    if (!judge) return NextResponse.json({ success: false, error: '无评委权限' }, { status: 403 });
    const group = verifyJudgeGroup(db, competitionId, groupId, judge.id);
    if (!group) return NextResponse.json({ success: false, error: '无评委权限' }, { status: 403 });
    const player = db.prepare(`
      SELECT p.id, COALESCE(p.player_no,'') AS player_no, p.name,
        COALESCE(p.organization,'') AS organization, COALESCE(p.teacher,'') AS teacher,
        COALESCE((SELECT ep.title FROM event_performances ep WHERE ep.player_id=p.id ORDER BY ep.id LIMIT 1),'') AS performance_title
      FROM event_players p
      WHERE p.id=? AND p.group_id=? AND p.competition_id=? AND p.audit_status!='rejected'
      LIMIT 1
    `).get<Record<string, any>>(playerId, groupId, competitionId);
    if (!player) return NextResponse.json({ success: false, error: '选手不存在或报名已失效' }, { status: 404 });
    const criteria = loadJudgeCriteria(db, competitionId, group);
    const currentScore = loadCurrentJudgeScore(db, groupId, playerId, judge.id, criteria);
    return NextResponse.json({ success: true, data: { event: { slug, title: event.title }, judge, group, player, criteria, currentScore } });
  } finally {
    db.close();
  }
}

export async function POST(request: Request, { params }: Context) {
  const memberId = getAuthenticatedMemberId(request);
  if (!memberId) return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
  const { slug, groupId: rawGroupId, playerId: rawPlayerId } = await params;
  const { event, competitionId, groupId, playerId } = contextValues(slug, rawGroupId, rawPlayerId);
  if (!event || !competitionId || !Number.isInteger(groupId) || !Number.isInteger(playerId)) {
    return NextResponse.json({ success: false, error: '页面不存在' }, { status: 404 });
  }
  const body = await request.json().catch(() => ({}));
  const db = openAdminDb();
  try {
    const judge = resolveJudge(db, memberId, competitionId);
    if (!judge) return NextResponse.json({ success: false, error: '无评委权限' }, { status: 403 });
    const group = verifyJudgeGroup(db, competitionId, groupId, judge.id);
    if (!group) return NextResponse.json({ success: false, error: '无评委权限' }, { status: 403 });
    const criteria = loadJudgeCriteria(db, competitionId, group);
    const result = saveJudgeScore(db, { competitionId, group, playerId, judge, criteria, values: body.scores || {} });
    return NextResponse.json({ success: true, data: result, message: '评分已提交' });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : '评分提交失败' }, { status: 400 });
  } finally {
    db.close();
  }
}
