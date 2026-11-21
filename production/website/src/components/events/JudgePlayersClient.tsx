'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ChevronRight, Search } from 'lucide-react';
import type { StudentSession } from '@/lib/student-auth';
import JudgeSession, { isCurrentJudgeSession } from './JudgeSession';

import { JudgeAvatar, JudgeIdentity } from './JudgePresentation';
import styles from './judging.module.css';

type Player = { id: number; player_no: string; name: string; organization: string; teacher: string; performance_title: string; my_score: number | null; avatarUrl?: string };

export default function JudgePlayersClient(props: { slug: string; groupId: string }) {
  const { slug, groupId } = props;
  return <JudgeSession>{session => <Workspace key={`${slug}/${groupId}`} {...props} session={session} />}</JudgeSession>;
}

function Workspace({ slug, groupId, session }: { slug: string; groupId: string } & { session: StudentSession }) {
  const [data, setData] = useState<{ event: { title: string }; judge: { name: string }; group: { name: string }; players: Player[] } | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('unscored');
  const [retry, setRetry] = useState(0);
  const endpoint = `/api/events-news/${slug}/judge/groups/${groupId}`;
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
  if (error) return <div className={styles.state}><p role="alert">{error}</p><button type="button" onClick={() => setRetry(n => n + 1)}>重试</button></div>;
  if (!data) return <p role="status" className={styles.state}>正在加载选手…</p>;
  const scored = data.players.filter(player => player.my_score != null).length;
  const remaining = data.players.length - scored;
  const filters = [['all', '全部'], ['unscored', `未评分 ${remaining}`], ['scored', `已评分 ${scored}`]];
  const visible = data.players.filter(player => filter === 'all' || (filter === 'scored' ? player.my_score != null : player.my_score == null))
    .filter(player => [player.name, player.player_no, player.performance_title, player.organization].join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <>
    <JudgeIdentity event={data.event.title} name={data.judge.name} />
    <nav className={styles.tabs} aria-label="评分组别">
      <Link prefetch={false} href={`/events/${slug}/judge?group=${groupId}`}>我的组别</Link>
      <span aria-current="page" className={styles.active}>当前组别</span>
    </nav>
    <h2 className={styles.sectionTitle}>{data.group.name}</h2>
    <section className={styles.progressCard} aria-labelledby="judge-progress">
      <div className={styles.spread}><h3 id="judge-progress">评分进度</h3><strong><b>{scored}</b> / {data.players.length}</strong></div>
      <progress aria-label="本人评分进度" max={Math.max(1, data.players.length)} value={scored} />
      <p>已评分 {scored} 位 · 未评分 {remaining} 位</p>
    </section>
    <label className={styles.search}>
      <Search size={18} aria-hidden="true" />
      <input type="search" aria-label="搜索选手或编号" placeholder="搜索选手或编号" value={query} onChange={e => setQuery(e.target.value)} />
    </label>
    <div className={styles.filters} aria-label="评分状态">
      {filters.map(([key, label]) => <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}
    </div>
    <div id="judge-players">
      {visible.length ? visible.map(player => {
        const hasScore = player.my_score != null;
        return <Link prefetch={false} key={player.id} href={`/events/${slug}/judge/groups/${groupId}/players/${player.id}`} className={`${styles.listRow} ${styles.playerRow}`}>
          <JudgeAvatar name={player.name} url={player.avatarUrl} />
          <div className={styles.rowCopy}>
            <strong><span>{player.player_no}</span> {player.name}</strong>
            <p>{player.performance_title ? `节目《${player.performance_title}》` : '节目未填写'}</p>
          </div>
          <div className={styles.playerResult}>
            <span className={styles.status}>{hasScore ? Number(player.my_score).toFixed(2) + ' 分' : '未评分'}</span>
            <span className={styles.rowAction}>{hasScore ? '查看' : '去评分'}<ChevronRight size={16} aria-hidden="true" /></span>
          </div>
        </Link>;
      }) : <p role="status" className={styles.state}>{query.trim() ? '未找到相关选手' : filter === 'scored' ? '暂无已评分记录' : !remaining && scored ? '该组别选手均已评分' : '该组别暂无可评分选手'}</p>}
    </div>
    <button type="button" aria-controls="judge-players" className={styles.record} onClick={() => { setQuery(''); setFilter('scored'); }}>查看已评分记录<ChevronRight size={16} aria-hidden="true" /></button>
    <p className={styles.note}>仅显示本人获授权的组别与选手</p>
  </>;
}
