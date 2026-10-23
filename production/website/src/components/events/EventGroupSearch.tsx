'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ChevronRight, Search } from 'lucide-react';
import type { PublicEventGroup } from '@/lib/public-event-data';

export default function EventGroupSearch({ groups, slug }: { groups: PublicEventGroup[]; slug: string }) {
  const [query, setQuery] = useState('');
  const [displayLimit, setDisplayLimit] = useState(50);
  const keyword = query.trim().toLocaleLowerCase();
  const visible = groups.filter(group => group.name.toLocaleLowerCase().includes(keyword));
  return <>
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h2 className="font-serif text-2xl font-bold text-text md:text-3xl">赛事组别</h2><p className="mt-1 text-sm text-text-muted">{groups.length} 个组别</p></div>
      <label className="relative block w-full sm:w-72"><span className="sr-only">搜索组别名称</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" /><input value={query} onChange={event => { setQuery(event.target.value); setDisplayLimit(50); }} placeholder="输入组别名称模糊搜索" className="h-10 w-full rounded-xl border border-sand/70 bg-white pl-9 pr-3 text-sm text-text outline-none focus:border-gold-dark" /></label>
    </div>
    {keyword && <p role="status" className="mt-4 text-sm text-text-muted">找到 {visible.length} 个组别</p>}
    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {visible.slice(0, displayLimit).map(group => <Link prefetch={false} key={group.id} href={`/events/${slug}/groups/${group.id}`} className="group flex min-w-0 items-center justify-between gap-3 rounded-xl border border-sand/50 bg-white px-4 py-4 text-text transition hover:border-gold-dark hover:bg-warm-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-dark">
        <div className="min-w-0"><div className="break-words text-base font-semibold leading-snug">{group.name}</div><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-muted"><span>{group.registration_public === 1 ? `${group.player_count} 位选手` : '报名信息暂未公开'}</span><span className={group.ranked_count ? 'text-gold-dark' : ''}>{group.ranked_count ? `${group.ranked_count} 项成绩` : '成绩待公布'}</span></div></div><ChevronRight className="h-4 w-4 shrink-0 text-gold-dark transition group-hover:translate-x-0.5" />
      </Link>)}
    </div>
    {visible.length > displayLimit && <div className="mt-5 text-center"><button type="button" onClick={() => setDisplayLimit(limit => limit + 50)} className="rounded-lg border border-gold-dark/40 bg-white px-5 py-2 text-sm font-semibold text-gold-dark">显示更多组别（还有 {visible.length - displayLimit} 个）</button></div>}
    {!visible.length && <div className="mt-5 rounded-2xl border border-sand/50 bg-white p-7 text-center text-sm text-text-muted">{groups.length ? '未找到相关组别' : '暂无赛事组别'}</div>}
  </>;
}
