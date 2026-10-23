import { NextResponse } from 'next/server';
import { getAuthenticatedMemberId } from '@/app/api/mini/_helpers';
import { getEventCompetitionId, getEventNewsBySlug } from '@/lib/events-news';
import { openAdminDb } from '@/lib/server/admin-db';
import { loadJudgePlayers, resolveJudge, verifyJudgeGroup } from '@/lib/server/event-judge';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ slug: string; groupId: string }> }) {
  const memberId = getAuthenticatedMemberId(request);
  if (!memberId) return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
  const { slug, groupId: rawGroupId } = await params;
  const event = getEventNewsBySlug(slug);
  const competitionId = event ? getEventCompetitionId(event) : null;
  const groupId = Number(rawGroupId);
  if (!event || !competitionId || !Number.isInteger(groupId)) return NextResponse.json({ success: false, error: '页面不存在' }, { status: 404 });

  const db = openAdminDb({ readonly: true });
  try {
    const judge = resolveJudge(db, memberId, competitionId);
    if (!judge) return NextResponse.json({ success: false, error: '无评委权限' }, { status: 403 });
    const group = verifyJudgeGroup(db, competitionId, groupId, judge.id);
    if (!group) return NextResponse.json({ success: false, error: '无评委权限' }, { status: 403 });
    const players = loadJudgePlayers(db, competitionId, groupId, judge.id);
    return NextResponse.json({ success: true, data: { event: { slug, title: event.title }, judge, group, players } });
  } finally {
    db.close();
  }
}
