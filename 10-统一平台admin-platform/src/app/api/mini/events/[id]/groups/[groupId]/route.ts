import {loadPublicGroupPlayers} from '@/lib/public-event-data';
import { GET as getEventDetail } from '../../route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ id: string; groupId: string }> }) {
  const { id, groupId } = await params;
  const response = await getEventDetail(request, { params: Promise.resolve({ id }) });
  if (!response.ok) return response;
  const { data } = await response.json();
  const group = data.groups.find((value: any) => value.id === Number(groupId));
  if (!group) return Response.json({ success: false, error: '组别不存在' }, { status: 404 });
  const ranks = data.rankings.filter((value: any) => value.groupId === group.id);
  const players = loadPublicGroupPlayers(Number(id), Number(groupId)).map(player => ({ id:player.id, groupId:group.id, name:player.name, playerNo:player.player_no, organization:player.organization, teacher:player.teacher, avatarUrl:player.avatar_url, rankNo:player.rank_no, publishedTotal:player.published_total, resultPublished:player.rank_no!=null }));
  return Response.json({ success: true, data: { competition: data.competition, group, players } },
    { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
}
