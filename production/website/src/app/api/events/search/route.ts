import { NextRequest, NextResponse } from 'next/server';
import { getEventCompetitionId, getEventsNews } from '@/lib/events-news';
import { searchPublicEventPlayers } from '@/lib/public-event-data';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim().slice(0, 50) || '';
  if (!query) return NextResponse.json({ players: [] });

  const slugs = new Map(
    getEventsNews()
      .map((event) => [getEventCompetitionId(event), event.slug] as const)
      .filter((entry): entry is [number, string] => entry[0] != null),
  );

  const players = searchPublicEventPlayers(query).flatMap((player) => {
    const slug = slugs.get(player.competition_id);
    return slug ? [{ ...player, slug }] : [];
  });

  return NextResponse.json({ players });
}
