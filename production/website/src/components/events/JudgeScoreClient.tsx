'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Send, ShieldAlert } from 'lucide-react';
import { getStudentSession } from '@/lib/student-auth';

type Criterion = { key: string; name: string; maxScore: number };
type Payload = { group: { name: string; scoring_status: string }; player: { name: string; player_no: string; organization: string; teacher: string; performance_title: string }; criteria: Criterion[]; currentScore: { values: Record<string, number>; total: number | null; status: string; needsRescore?: boolean } };

export default function JudgeScoreClient({ slug, groupId, playerId }: { slug: string; groupId: string; playerId: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const endpoint = `/api/events-news/${slug}/judge/groups/${groupId}/players/${playerId}`;

  useEffect(() => {
    const session = getStudentSession();
    if (!session) { setError('请先登录'); return; }
    fetch(endpoint, { headers: { Authorization: `Bearer ${session.token}` } })
      .then(async (response) => { const payload = await response.json(); if (!response.ok || !payload.success) throw new Error(payload.error || '加载失败'); setData(payload.data); setScores(Object.fromEntries(payload.data.criteria.map((item: Criterion) => [item.key, payload.data.currentScore.values[item.key] ?? '']))); })
      .catch((reason) => setError(reason instanceof Error ? reason.message : '加载失败'));
  }, [endpoint]);
  const total = useMemo(() => Object.values(scores).reduce((sum, value) => sum + (Number(value) || 0), 0), [scores]);

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setMessage('');
    const session = getStudentSession(); if (!session) { setError('请先登录'); return; }
    setSaving(true);
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ scores }) });
      const payload = await response.json(); if (!response.ok || !payload.success) throw new Error(payload.error || '评分提交失败');
      setMessage(`评分已提交，我的评分：${Number(payload.data.total).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`);
      setData((current) => current ? { ...current, currentScore: { values: Object.fromEntries(Object.entries(scores).map(([key, value]) => [key, Number(value)])), total: payload.data.total, status: 'submitted' } } : current);
    } catch (reason) { setError(reason instanceof Error ? reason.message : '评分提交失败'); } finally { setSaving(false); }
  }

  if (!data) return <State message={error || '正在加载评分表…'} />;
  const submitted = !data.currentScore.needsRescore && ['submitted', 'reviewed', 'published'].includes(data.currentScore.status);
  return <>
    <section className="rounded-xl bg-[#1A1A1A] p-4 text-white"><div className="text-[11px] text-gold">{data.group.name}</div><h1 className="mt-1 font-serif text-2xl font-bold">{data.player.name}</h1><div className="mt-1 text-xs text-white/60">{[data.player.player_no && `编号 ${data.player.player_no}`, data.player.performance_title, data.player.organization].filter(Boolean).join(' · ')}</div></section>
    {data.currentScore.needsRescore && <p role="alert" className="mt-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">历史评分为 {data.currentScore.total}，超出当前满分。请按当前10分制重新填写并提交评分。</p>}
    {submitted && <div className="mt-4 flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3 text-emerald-800"><span className="inline-flex items-center gap-2 text-sm font-semibold"><CheckCircle2 className="h-4 w-4" />我的评分结果</span><strong className="text-xl">{data.currentScore.total?.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}</strong></div>}
    <form onSubmit={submit} className="mt-4 rounded-2xl border border-sand/60 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold text-text">评分项</h2><strong className="text-crimson">合计 {total.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}</strong></div>
      <div className="space-y-3">{data.criteria.map((criterion) => <label key={criterion.key} className="flex flex-col items-stretch justify-between gap-2 rounded-lg bg-warm-white px-3 py-3 sm:flex-row sm:items-center sm:gap-4"><span className="min-w-0 text-sm font-medium text-text">{criterion.name}<small className="ml-1 text-text-muted">/ {criterion.maxScore}</small></span><input required inputMode="decimal" type="number" min="0" max={criterion.maxScore} step="0.01" value={scores[criterion.key] ?? ''} onChange={(event) => setScores((current) => ({ ...current, [criterion.key]: event.target.value }))} aria-label={`${criterion.name}，满分${criterion.maxScore}分`} style={{ lineHeight: 'normal', WebkitTextFillColor: '#2C1810' }} className="h-14 w-full rounded-lg border border-sand bg-white px-3 py-0 text-right text-xl font-bold text-text outline-none focus:border-gold-dark sm:w-28" /></label>)}</div>
      {error && <div className="mt-3 text-sm text-crimson">{error}</div>}{message && <div className="mt-3 text-sm font-medium text-emerald-700">{message}</div>}
      <button disabled={saving || data.group.scoring_status === 'locked'} className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-crimson font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"><Send className="h-4 w-4" />{saving ? '正在提交…' : submitted ? '修改并重新提交' : '提交评分'}</button>
    </form>
    <Link href={`/events/${slug}/judge/groups/${groupId}`} prefetch={false} aria-disabled={saving} onClick={(event) => { if (saving) event.preventDefault(); }} className="mt-4 flex min-h-11 w-full items-center justify-center rounded-lg border border-sand bg-white px-4 py-3 font-semibold text-crimson">
      返回选手列表，继续评分
    </Link>
  </>;
}

function State({ message }: { message: string }) { return <div className="rounded-2xl border border-sand/60 bg-white p-10 text-center text-sm text-text-muted"><ShieldAlert className="mx-auto mb-3 h-7 w-7 text-gold-dark" />{message}</div>; }
