'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ChevronRight, Search } from 'lucide-react';
import PlayerAvatar from './PlayerAvatar';
import type { PublicEventPlayer } from '@/lib/public-event-data';

export default function EventPeopleSearch({ players, slug, results = false }: {
  players: PublicEventPlayer[]; slug: string; results?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(50);
  const needle = query.trim().toLocaleLowerCase();
  const visible = players.filter(player => (!results || player.published_total !== null) &&
    [player.name, player.player_no, player.group_name, player.organization, player.teacher].join(' ').toLocaleLowerCase().includes(needle));
  return <section>
    <h2 className="text-xl font-bold text-text">{results ? '公示成绩' : '参赛选手'}</h2>
    <label className="relative mt-4 block"><span className="sr-only">搜索选手、编号或机构</span><Search aria-hidden="true" className="absolute left-3 top-4 h-5 w-5 text-text-muted" /><input value={query} onChange={event => { setQuery(event.target.value); setLimit(50); }} placeholder="搜索选手、编号或机构" className="h-12 w-full rounded-xl border border-sand bg-white pl-10 pr-3 text-base text-text" /></label>
    <p role="status" className="my-3 text-sm text-text-muted">{visible.length} 位{results ? '已公示成绩选手' : '已公开选手'}</p>
    <div className="divide-y divide-sand/50">
      {visible.slice(0, limit).map(player => <Link key={player.id} prefetch={false} href={`/events/${slug}/groups/${player.group_id}/players/${player.id}`} className="flex min-h-20 items-center gap-3 py-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-crimson">
        <PlayerAvatar name={player.name} src={player.avatar_url} />
        <span className="min-w-0 flex-1"><strong className="block text-base text-text">{player.name}</strong><span className="mt-1 block text-sm text-text-muted">{[player.group_name, player.player_no && `编号 ${player.player_no}`, player.organization].filter(Boolean).join(' · ')}</span></span>
        {results && <span className="text-right"><strong className="block font-semibold tabular-nums text-crimson">{player.published_total === null ? '—' : player.published_total.toFixed(3).replace(/\.?0+$/, '')}</strong><span className="text-xs text-text-muted">最终得分</span></span>}
        <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-text-muted" />
      </Link>)}
    </div>
    {!visible.length && <p className="py-10 text-center text-sm text-text-muted">{needle ? '未找到匹配选手' : results ? '成绩经赛事平台审核发布后在这里展示' : '暂无已公开选手'}</p>}
    {visible.length > limit && <button type="button" onClick={() => setLimit(value => value + 50)} className="mt-4 min-h-11 rounded-xl border border-sand bg-white px-5 text-sm font-semibold text-crimson">显示更多选手</button>}
  </section>;
}
