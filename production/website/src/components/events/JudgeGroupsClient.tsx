'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Search, ShieldAlert } from 'lucide-react';
import type { StudentSession } from '@/lib/student-auth';
import JudgeSession, { isCurrentJudgeSession } from './JudgeSession';

import { JudgeIdentity } from './JudgePresentation';
import styles from './judging.module.css';

type Group = { id: number; name: string; player_count: number; scored_count: number };
const GROUPS_PER_PAGE = 12;

type WorkspaceProps = { slug: string; eventTitle: string; previousGroup?: string };

export default function JudgeGroupsClient(props: WorkspaceProps) {
  const { slug } = props;
  return <JudgeSession>{session => <Workspace key={slug} {...props} session={session} />}</JudgeSession>;
}

function Workspace({ slug, eventTitle, previousGroup, session }: WorkspaceProps & { session: StudentSession }) {
  const [data, setData] = useState<{ judge: { name: string }; groups: Group[] } | null>(null);
  const [query, setQuery] = useState('');
  const [selectedPage, setSelectedPage] = useState<number | null>(null);
  const [error, setError] = useState('');

  const [retry, setRetry] = useState(0);
  const endpoint = `/api/events-news/${slug}/judge`;
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    fetch(endpoint, {
      cache: 'no-store',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${session.token}` },
    })
      .then(async response => {
        const payload = await response.json();
        if (!response.ok || !payload.success) throw new Error(payload.error || '加载失败');
        if (!controller.signal.aborted && isCurrentJudgeSession(session)) setData(payload.data);
      })
      .catch(reason => {
        if (!controller.signal.aborted && isCurrentJudgeSession(session)) {
          setError(reason instanceof Error ? reason.message : '加载失败');
        }
      });
    return () => controller.abort();
  }, [endpoint, retry, session]);

  if (error) return <PermissionState message={error} retry={() => setRetry(n => n + 1)} />;
  if (!data) return <p role="status" className={styles.state}>正在加载评委任务…</p>;
  const previousIndex = data.groups.findIndex(group => String(group.id) === previousGroup);
  const current = data.groups[previousIndex] ?? data.groups[0];
  const keyword = query.trim().toLocaleLowerCase();
  const matches = data.groups.filter(group => group.name.toLocaleLowerCase().includes(keyword));
  const pageCount = Math.max(1, Math.ceil(matches.length / GROUPS_PER_PAGE));
  const returnPage = Math.floor(Math.max(0, previousIndex) / GROUPS_PER_PAGE) + 1;
  const page = Math.min(selectedPage ?? returnPage, pageCount);
  const first = (page - 1) * GROUPS_PER_PAGE;
  const visible = matches.slice(first, first + GROUPS_PER_PAGE);
  return <>
    <JudgeIdentity event={eventTitle} name={data.judge.name} />
    <nav className={styles.tabs} aria-label="评分组别">
      <span className={styles.active} aria-current="page">我的组别</span>
      {current
        ? <Link prefetch={false} href={`/events/${slug}/judge/groups/${current.id}`}>当前组别</Link>
        : <span aria-disabled="true">当前组别</span>}
    </nav>
    <label className={styles.search}>
      <Search size={18} aria-hidden="true" />
      <input type="search" aria-label="搜索组别" placeholder="搜索组别" value={query} onChange={event => {
        const value = event.target.value;
        setQuery(value);
        setSelectedPage(value.trim() ? 1 : null);
      }} />
    </label>
    <div className={styles.groupListBar}>
      <p role="status">
        {keyword ? `找到 ${matches.length} / ${data.groups.length} 个组别` : `已授权 ${data.groups.length} 个组别`}
        {pageCount > 1 && <span className={styles.pageNumber}>第 {page} / {pageCount} 页</span>}
      </p>
      {pageCount > 1 && <nav aria-label="组别分页" className={styles.groupPager}>
        <button type="button" disabled={page === 1} onClick={() => setSelectedPage(page - 1)}>上一页</button>
        <button type="button" disabled={page === pageCount} onClick={() => setSelectedPage(page + 1)}>下一页</button>
      </nav>}
    </div>
    {visible.length ? <ul className={styles.groupList} aria-label="已授权组别">
      {visible.map(group => <li key={group.id}>
        <Link prefetch={false} href={`/events/${slug}/judge/groups/${group.id}`} className={styles.listRow}>
          <div className={styles.rowCopy}><strong>{group.name}</strong><p>已评分 {group.scored_count} / {group.player_count}</p></div>
          <span className={styles.groupEntry}>进入<ArrowRight size={16} aria-hidden="true" /></span>
        </Link>
      </li>)}
    </ul> : <p className={styles.state}>{keyword ? '未找到相关组别' : '暂无获授权的评分组别'}</p>}
  </>;
}

function PermissionState({ message, retry }: { message: string; retry: () => void }) {
  return <div className={styles.state}><ShieldAlert size={24} aria-hidden="true" /><p role="status">{message}</p><button type="button" onClick={retry}>重试</button></div>;
}
