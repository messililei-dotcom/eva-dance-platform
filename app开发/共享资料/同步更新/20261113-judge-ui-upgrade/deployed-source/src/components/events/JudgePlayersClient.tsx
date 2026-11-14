'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CheckCircle2, ChevronRight, ShieldAlert } from 'lucide-react';
import { getStudentSession, STUDENT_AUTH_CHANGED_EVENT } from '@/lib/student-auth';

type Player = { id: number; player_no: string; name: string; organization: string; teacher: string; performance_title: string; my_score: number | null; my_score_status: string };

export default function JudgePlayersClient({ slug, groupId }: { slug: string; groupId: string }) {
  const [data, setData] = useState<{ group: { name: string }; players: Player[] } | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [filter,setFilter]=useState('all');
  useEffect(() => {
    let active=true;const invalidate=()=>{active=false;setData(null);setError("账号已变化，请重新打开评委入口");};window.addEventListener(STUDENT_AUTH_CHANGED_EVENT,invalidate);window.addEventListener("storage",invalidate);
    const session = getStudentSession();
    if (!session) { setError('请先登录'); return()=>{window.removeEventListener(STUDENT_AUTH_CHANGED_EVENT,invalidate);window.removeEventListener('storage',invalidate);}; }
    fetch(`/api/events-news/${slug}/judge/groups/${groupId}`, { cache:'no-store', headers: { Authorization: `Bearer ${session.token}` } })
      .then(async (response) => { const payload = await response.json(); if (!response.ok || !payload.success) throw new Error(payload.error || '加载失败'); if(active&&getStudentSession()?.token===session.token)setData(payload.data); })
      .catch((reason) => {if(active)setError(reason instanceof Error ? reason.message : '加载失败');});
    return()=>{active=false;window.removeEventListener(STUDENT_AUTH_CHANGED_EVENT,invalidate);window.removeEventListener('storage',invalidate);};
  }, [slug, groupId]);
  if (error) return <State message={error} />;
  if (!data) return <State message="正在加载选手…" />;
  const scoredCount=data.players.filter(p=>p.my_score!==null).length;
  const visible = data.players.filter(p=>filter==='all'||(filter==='scored'?p.my_score!==null:p.my_score===null)).filter(player => [data.group.name, player.name, player.player_no, player.performance_title, player.organization].join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return (
    <>
      <div className="mb-4 rounded-xl border border-sand bg-white p-4 text-text"><div className="text-[11px] text-crimson">评分组别</div><h1 className="mt-1 font-serif text-xl font-bold">{data.group.name}</h1></div>
      <section className="mb-4 rounded-xl border border-sand bg-white p-4"><p className="mb-3 font-semibold text-text">评分进度 {scoredCount} / {data.players.length}</p><progress aria-label="本人评分进度" max={Math.max(1,data.players.length)} value={scoredCount} className="h-2 w-full accent-[#9e1726]"/><div className="mt-4 flex gap-2">{[['all','全部'],['unscored','未评分'],['scored','已评分']].map(([key,label])=><button type="button" key={key} aria-pressed={key===filter} onClick={()=>setFilter(key)} className={`min-h-11 flex-1 rounded-lg text-sm font-semibold ${key===filter?'bg-crimson text-white':'bg-warm-white text-text'}`}>{label}</button>)}</div></section>
      <input aria-label="搜索组别或选手" placeholder="搜索组别、选手姓名、编号或曲目" value={query} onChange={e => setQuery(e.target.value)} className="mb-4 w-full rounded-lg border border-sand bg-white px-4 py-3 text-sm outline-none focus:border-gold-dark" />
      {visible.length ? <div className="space-y-2.5">{visible.map((player) => {
        const scored = ['submitted', 'reviewed', 'published'].includes(player.my_score_status);
        return <Link prefetch={false} key={player.id} href={`/events/${slug}/judge/groups/${groupId}/players/${player.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-sand/60 bg-white p-4 shadow-sm transition hover:border-gold-dark">
          <div className="min-w-0"><div className="flex items-center gap-2"><span className="truncate font-semibold text-text">{player.name}</span>{scored && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />}</div><div className="mt-1 truncate text-xs text-text-muted">{[player.player_no && `编号 ${player.player_no}`, player.performance_title, player.organization].filter(Boolean).join(' · ') || '选手信息'}</div></div>
          <div className="flex shrink-0 items-center gap-2"><div className="text-right"><div className={`font-bold ${scored ? 'text-crimson' : 'text-text-muted'}`}>{scored ? Number(player.my_score).toLocaleString('zh-CN', { maximumFractionDigits: 2 }) : '待评分'}</div>{scored && <div className="text-[10px] text-text-muted">我的评分</div>}</div><ChevronRight className="h-4 w-4 text-crimson-dark" /></div>
        </Link>;
      })}</div> : <State message={query.trim() ? "未找到相关选手" : "该组别暂无可评分选手"} />}
    </>
  );
}

function State({ message }: { message: string }) { return <div className="rounded-2xl border border-sand/60 bg-white p-10 text-center text-sm text-text-muted"><ShieldAlert className="mx-auto mb-3 h-7 w-7 text-crimson-dark" />{message}<button className="mt-4 block min-h-11 w-full font-semibold text-crimson" onClick={()=>window.location.reload()}>重新加载</button></div>; }
