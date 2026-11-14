'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ChevronRight, Search, Trophy } from 'lucide-react';
import { eventAgeGroup } from '@/lib/event-age';
import type { PublicEventGroup } from '@/lib/public-event-data';
import styles from '@/app/events-news/events.module.css';

export default function EventGroupSearch({ groups, slug, registrationOpen = false }: {
  groups: PublicEventGroup[]; slug: string; registrationOpen?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [ageFilter, setAgeFilter] = useState('全部');
  const [displayLimit, setDisplayLimit] = useState(50);
  const keyword = query.trim().toLocaleLowerCase();
  const visible = groups.filter(group => (ageFilter === '全部' || eventAgeGroup(group.name, group.age_range) === ageFilter) &&
    [group.name, group.age_range, group.dance_type, group.entry_type].join(' ').toLocaleLowerCase().includes(keyword));
  return <>
    <div className={styles.groupSearchHeading}><h2>赛事组别</h2><span>共{groups.length}组</span></div>
    <label className={styles.groupSearch}><span className="sr-only">搜索组别、舞种或年龄</span><Search aria-hidden="true" size={20} /><input value={query} onChange={event => { setQuery(event.target.value); setDisplayLimit(50); }} placeholder="搜索组别、舞种或年龄" /></label>
    <div className={styles.ageFilters} role="group" aria-label="组别年龄筛选">
      {['全部', '成人', '青少年', '少儿'].map(label => <button type="button" key={label} aria-pressed={ageFilter === label} onClick={() => { setAgeFilter(label); setDisplayLimit(50); }}>{label}</button>)}
    </div>
    {(keyword || ageFilter !== '全部') && <p role="status" className="mb-3 text-sm text-text-muted">找到 {visible.length} 个组别</p>}
    <div className={styles.groupCards}>
      {visible.slice(0, displayLimit).map(group => <Link prefetch={false} key={group.id} href={`/events/${slug}/groups/${group.id}`} className={styles.groupCard}>
        <span className={styles.groupIcon} aria-hidden="true"><Trophy size={23} strokeWidth={1.5} /></span>
        <span className={styles.groupCardText}><strong>{group.name}</strong><span>{[group.age_range, group.registration_public === 1 ? `${group.player_count}位选手` : '报名信息暂未公开'].filter(Boolean).join(' · ')}</span></span>
        <span className={styles.groupBadge} data-published={Boolean(group.ranked_count)}>{group.ranking_complete === 1 ? '成绩已公布' : group.ranked_count ? `已公示${group.ranked_count}项得分` : registrationOpen ? '报名中' : '成绩待公布'}</span>
        <ChevronRight aria-hidden="true" size={18} className="shrink-0 text-text-muted" />
      </Link>)}
    </div>
    {visible.length > displayLimit && <div className="mt-5 text-center"><button type="button" onClick={() => setDisplayLimit(limit => limit + 50)} className="min-h-11 rounded-xl border border-sand bg-white px-5 text-sm font-semibold text-crimson">显示更多组别（还有 {visible.length - displayLimit} 个）</button></div>}
    {!visible.length && <div className="rounded-xl bg-white p-7 text-center text-sm text-text-muted">{groups.length ? '未找到相关组别' : '组别信息暂未发布'}</div>}
  </>;
}
