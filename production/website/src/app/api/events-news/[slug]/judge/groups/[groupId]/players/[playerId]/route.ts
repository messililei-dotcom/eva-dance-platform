import { NextResponse } from 'next/server';
import { getAuthenticatedMemberId } from '@/app/api/mini/_helpers';
import { getEventCompetitionId, getEventNewsBySlug } from '@/lib/events-news';
import { openAdminDb } from '@/lib/server/admin-db';
import {
  loadCurrentJudgeScore,
  loadJudgeCriteria,
  loadJudgePlayers,
  resolveJudge,
  saveJudgeScore,
  verifyJudgeGroup,
} from '@/lib/server/event-judge';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const privateResponse = { headers: { 'Cache-Control': 'private, no-store' } };

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
  if (!memberId) return NextResponse.json({ success: false, error: '请先登录' }, { status: 401, ...privateResponse });
  const { slug, groupId: rawGroupId, playerId: rawPlayerId } = await params;
  const { event, competitionId, groupId, playerId } = contextValues(slug, rawGroupId, rawPlayerId);
  if (!event || !competitionId || !Number.isInteger(groupId) || !Number.isInteger(playerId)) {
    return NextResponse.json({ success: false, error: '页面不存在' }, { status: 404, ...privateResponse });
  }
  const db = openAdminDb({ readonly: true });
  try {
    const judge = resolveJudge(db, memberId, competitionId);
    if (!judge) return NextResponse.json({ success: false, error: '无评委权限' }, { status: 403, ...privateResponse });
    const group = verifyJudgeGroup(db, competitionId, groupId, judge.id);
    if (!group) return NextResponse.json({ success: false, error: '无评委权限' }, { status: 403, ...privateResponse });
    const [player] = loadJudgePlayers(db, competitionId, groupId, judge.id, playerId);
    if (!player) return NextResponse.json({ success: false, error: '选手不存在或报名已失效' }, { status: 404, ...privateResponse });
    const criteria = loadJudgeCriteria(db, competitionId, group);
    const currentScore = loadCurrentJudgeScore(db, groupId, playerId, judge.id, criteria);
    return NextResponse.json({ success: true, data: { event: { slug, title: event.title }, judge, group, player, criteria, currentScore } }, privateResponse);
  } finally {
    db.close();
  }
}

export async function POST(request: Request, { params }: Context) {
  const memberId = getAuthenticatedMemberId(request);
  if (!memberId) return NextResponse.json({ success: false, error: '请先登录' }, { status: 401, ...privateResponse });
  const { slug, groupId: rawGroupId, playerId: rawPlayerId } = await params;
  const { event, competitionId, groupId, playerId } = contextValues(slug, rawGroupId, rawPlayerId);
  if (!event || !competitionId || !Number.isInteger(groupId) || !Number.isInteger(playerId)) {
    return NextResponse.json({ success: false, error: '页面不存在' }, { status: 404, ...privateResponse });
  }
  const body = await request.json().catch(() => ({}));
  const db = openAdminDb();
  try {
    const judge = resolveJudge(db, memberId, competitionId);
    if (!judge) return NextResponse.json({ success: false, error: '无评委权限' }, { status: 403, ...privateResponse });
    const group = verifyJudgeGroup(db, competitionId, groupId, judge.id);
    if (!group) return NextResponse.json({ success: false, error: '无评委权限' }, { status: 403, ...privateResponse });
    const criteria = loadJudgeCriteria(db, competitionId, group);
    const result = saveJudgeScore(db, { competitionId, group, playerId, judge, criteria, values: body.scores || {} });
    return NextResponse.json({ success: true, data: result, message: '评分已提交' }, privateResponse);
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : '评分提交失败' }, { status: 400, ...privateResponse });
  } finally {
    db.close();
  }
}
