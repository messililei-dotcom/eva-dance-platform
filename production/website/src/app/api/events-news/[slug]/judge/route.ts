import { NextResponse } from 'next/server';
import { getAuthenticatedMemberId } from '@/app/api/mini/_helpers';
import { getEventCompetitionId, getEventNewsBySlug } from '@/lib/events-news';
import { openAdminDb } from '@/lib/server/admin-db';
import { loadJudgeGroups, resolveJudge } from '@/lib/server/event-judge';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const privateResponse = { headers: { 'Cache-Control': 'private, no-store' } };

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const memberId = getAuthenticatedMemberId(request);
  if (!memberId) return NextResponse.json({ success: false, error: '请先登录' }, { status: 401, ...privateResponse });
  const { slug } = await params;
  const event = getEventNewsBySlug(slug);
  const competitionId = event ? getEventCompetitionId(event) : null;
  if (!event || !competitionId) return NextResponse.json({ success: false, error: '赛事不存在' }, { status: 404, ...privateResponse });

  const db = openAdminDb({ readonly: true });
  try {
    const judge = resolveJudge(db, memberId, competitionId);
    if (!judge) return NextResponse.json({ success: false, error: '无评委权限' }, { status: 403, ...privateResponse });
    const groups = loadJudgeGroups(db, competitionId, judge.id);
    return NextResponse.json({ success: true, data: { event: { slug, title: event.title }, judge, groups } }, privateResponse);
  } finally {
    db.close();
  }
}
