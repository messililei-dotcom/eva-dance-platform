'use client';

import Link from 'next/link';
import { Search, UserRound, X } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';

type EventOption = {
  slug: string;
  title: string;
  location: string;
};

type PlayerResult = {
  id: number;
  group_id: number;
  name: string;
  player_no: string;
  organization: string;
  group_name: string;
  event_name: string;
  slug: string;
};

export default function EventPlatformSearch({ events }: { events: EventOption[] }) {
  const [query, setQuery] = useState('');
  const [players, setPlayers] = useState<PlayerResult[]>([]);
  const [loading, setLoading] = useState(false);
  const term = query.trim().toLocaleLowerCase('zh-CN');
  const matchingEvents = useMemo(() => term
    ? events.filter((event) => `${event.title} ${event.location}`.toLocaleLowerCase('zh-CN').includes(term)).slice(0, 6)
    : [], [events, term]);

  useEffect(() => {
    if (!term) {
      setPlayers([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/events/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
        const data = response.ok ? await response.json() as { players?: PlayerResult[] } : {};
        setPlayers(data.players || []);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') setPlayers([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, term]);

  const firstHref = matchingEvents[0]
    ? `/events/${matchingEvents[0].slug}`
    : players[0]
      ? `/events/${players[0].slug}/groups/${players[0].group_id}/players/${players[0].id}`
      : '';

  function submit(event: FormEvent) {
    event.preventDefault();
    if (firstHref) window.location.assign(firstHref);
  }

  const showResults = Boolean(term);

  return (
    <div className="relative ml-auto w-44 shrink-0 md:w-48">
      <form onSubmit={submit} role="search" className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gold-dark" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索赛事或选手"
          aria-label="搜索赛事或选手"
          className="h-10 w-full rounded-full border border-sand bg-white pl-9 pr-9 text-sm text-text shadow-sm outline-none transition focus:border-gold-dark focus:ring-2 focus:ring-gold/20 md:h-11"
        />
        {query && (
          <button type="button" onClick={() => setQuery('')} aria-label="清空搜索" className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-text-muted hover:bg-sand/40">
            <X className="h-4 w-4" />
          </button>
        )}
      </form>

      {showResults && (
        <div className="absolute right-0 top-full z-30 mt-2 max-h-[60vh] w-[min(92vw,36rem)] overflow-y-auto rounded-xl border border-sand bg-white p-2 shadow-xl">
          {matchingEvents.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[11px] font-medium text-text-muted">赛事</div>
              {matchingEvents.map((event) => (
                <Link key={event.slug} href={`/events/${event.slug}`} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-warm-white">
                  <Search className="h-4 w-4 shrink-0 text-gold-dark" />
                  <span className="min-w-0 flex-1 truncate font-medium">{event.title}</span>
                  <span className="shrink-0 text-xs text-text-muted">{event.location}</span>
                </Link>
              ))}
            </div>
          )}

          {players.length > 0 && (
            <div className={matchingEvents.length ? 'mt-1 border-t border-sand/60 pt-1' : ''}>
              <div className="px-2 py-1 text-[11px] font-medium text-text-muted">选手</div>
              {players.map((player) => (
                <Link key={`${player.group_id}-${player.id}`} href={`/events/${player.slug}/groups/${player.group_id}/players/${player.id}`} className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-warm-white">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sand/50 text-crimson"><UserRound className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-text">{player.name}{player.player_no ? ` · ${player.player_no}` : ''}</span>
                    <span className="block truncate text-[11px] text-text-muted">{player.event_name} · {player.group_name}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}

          {!loading && matchingEvents.length === 0 && players.length === 0 && (
            <div className="px-3 py-5 text-center text-sm text-text-muted">未找到相关赛事或选手</div>
          )}
          {loading && players.length === 0 && <div className="px-3 py-4 text-center text-sm text-text-muted">正在搜索…</div>}
        </div>
      )}
    </div>
  );
}
