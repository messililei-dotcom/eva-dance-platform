'use client';
import { type CSSProperties, type FormEvent, useEffect, useRef, useState } from 'react';
import { CheckCircle2, PencilLine, ShieldAlert } from 'lucide-react';
import type { StudentSession } from '@/lib/student-auth';
import JudgeSession, { isCurrentJudgeSession } from './JudgeSession';
import { distributeScores } from '@/lib/score-allocation';
import styles from './judging.module.css';
import { JudgeAvatar } from './JudgePresentation';
type Criterion = { key: string; name: string; maxScore: number };
type Payload = { group: { name: string; scoring_status: string }; player: { name: string; player_no: string; organization: string; performance_title: string; avatarUrl?: string }; criteria: Criterion[]; currentScore: { values: Record<string, number>; total: number | null; status: string; needsRescore?: boolean } };
type ScoreRoute = { slug: string; groupId: string; playerId: string };

export default function JudgeScoreClient(props: ScoreRoute) {
 const { slug, groupId, playerId } = props;
 return <JudgeSession>{session => <ScoreForm key={`${slug}/${groupId}/${playerId}`} {...props} session={session} />}</JudgeSession>;
}

function ScoreForm({ slug, groupId, playerId, session }: ScoreRoute & { session: StudentSession }) {
 const [data,setData]=useState<Payload|null>(null),[scores,setScores]=useState<Record<string,string>>({}),[error,setError]=useState(''),[message,setMessage]=useState(''),[saving,setSaving]=useState(false),[retry,setRetry]=useState(0),[draft,setDraft]=useState<string|null>(null);
 const loadSignal = useRef<AbortSignal | null>(null);
 const weights=useRef<number[]>([]),inflight=useRef(false);
 const endpoint=`/api/events-news/${slug}/judge/groups/${groupId}/players/${playerId}`;
 useEffect(() => {
  const controller = new AbortController();
  loadSignal.current = controller.signal;
  setError('');
  fetch(endpoint, {
   cache: 'no-store',
   signal: controller.signal,
   headers: { Authorization: `Bearer ${session.token}` },
  }).then(async response => {
   const payload = await response.json();
   if (!response.ok || !payload.success) throw new Error(payload.error || '加载失败');
   if (controller.signal.aborted || !isCurrentJudgeSession(session)) return;
   setData(payload.data);
   setScores(Object.fromEntries(payload.data.criteria.map((criterion: Criterion) => [
    criterion.key,
    payload.data.currentScore.values[criterion.key] == null ? '' : Number(payload.data.currentScore.values[criterion.key]).toFixed(2),
   ])));
  }).catch(reason => {
   if (!controller.signal.aborted && isCurrentJudgeSession(session)) {
    setError(reason instanceof Error ? reason.message : '加载失败');
   }
  });
  return () => controller.abort();
 }, [endpoint, retry, session]);
 const criteria=data?.criteria||[],total=criteria.reduce((s,c)=>s+(Number(scores[c.key])||0),0),max=criteria.reduce((s,c)=>s+c.maxScore,0),locked=data?.group.scoring_status==='locked';
 const valid=criteria.length>0&&criteria.every(c=>String(scores[c.key]??'').trim()!==''&&Number.isFinite(Number(scores[c.key]))&&Number(scores[c.key])>=0&&Number(scores[c.key])<=c.maxScore)&& (draft===null||(draft.trim()!==''&&Number.isFinite(Number(draft))&&Number(draft)>=0&&Number(draft)<=max));
 function editTotal(raw:string){setDraft(raw);if(raw.trim()===''||!Number.isFinite(Number(raw))||Number(raw)<0||Number(raw)>max)return;const next=distributeScores(criteria.map(c=>c.maxScore),weights.current,Number(raw));setScores(Object.fromEntries(criteria.map((c,i)=>[c.key,next[i].toFixed(2)])));setMessage('');}
 async function submit(event: FormEvent) {
  event.preventDefault();
  if (inflight.current || locked || !valid || !data) return;
  if (!isCurrentJudgeSession(session)) return;
  if (!window.confirm(`确认提交 ${data.player.name} 的本人评分？合计 ${total.toFixed(2)} 分`)) return;
  if (!isCurrentJudgeSession(session)) return;

  const signal = loadSignal.current;
  const ownsForm = () => !signal?.aborted && isCurrentJudgeSession(session);
  inflight.current = true;
  setSaving(true);
  setError('');
  setMessage('');
  try {
   const response = await fetch(endpoint, {
    method: 'POST',
    cache: 'no-store',
    headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ scores }),
   });
   const payload = await response.json();
   if (!ownsForm()) return;
   if (!response.ok || !payload.success) throw new Error(payload.error || '评分提交失败');
   setMessage(`评分已提交，本人评分：${Number(payload.data.total).toFixed(2)}`);
   setData(current => current && {
    ...current,
    currentScore: {
     values: Object.fromEntries(Object.entries(scores).map(([key, value]) => [key, Number(value)])),
     total: payload.data.total,
     status: 'submitted',
    },
   });
  } catch (reason) {
   if (ownsForm()) setError(reason instanceof Error ? reason.message : '提交失败，请重试');
  } finally {
   inflight.current = false;
   if (ownsForm()) setSaving(false);
  }
 }
 if(!data)return <div className={styles.state}><ShieldAlert aria-hidden="true"/><p role="status">{error||'正在加载评分表…'}</p>{error&&<button onClick={()=>setRetry(n=>n+1)}>重新加载</button>}</div>;
 const submitted=!data.currentScore.needsRescore&&['submitted','reviewed','published'].includes(data.currentScore.status);
 const displayTotal = locked && data.currentScore.total == null ? '' : locked ? data.currentScore.total?.toFixed(2) : draft ?? total.toFixed(2);
 return <>
  <section className={styles.identity}>
   <JudgeAvatar name={data.player.name} url={data.player.avatarUrl} />
   <div className={styles.rowCopy}>
    <h2><span>{data.player.player_no}</span> {data.player.name}</h2>
    <p>{data.player.performance_title ? `节目《${data.player.performance_title}》` : '节目未填写'}</p>
   </div>
  </section>
  {!locked && data.currentScore.needsRescore && <p role="alert" className={styles.error}>评分规则已变化，请按当前规则重新评分。</p>}
  {submitted && <p className={styles.success}><CheckCircle2 size={18} />本人已提交：{data.currentScore.total?.toFixed(2)} 分</p>}
  <form onSubmit={submit}>
   <fieldset disabled={saving || locked} className={styles.fields}>
    <legend className={styles.sectionTitle}>评分项目 <small>满分 {max} 分</small></legend>
    {!locked && <p className={styles.hint}>输入分数，或左右拖动调节</p>}
    {criteria.map(criterion => {
     const value = Math.min(criterion.maxScore, Math.max(0, Number(scores[criterion.key]) || 0));
     return <div className={styles.criterion} key={criterion.key}>
      <div className={styles.criterionHeading}>
       <label htmlFor={`score-${criterion.key}`}>{criterion.name}</label><small>满分 {criterion.maxScore} 分</small>
       <input id={`score-${criterion.key}`} required type="number" inputMode="decimal" min={0} max={criterion.maxScore} step="0.01" value={scores[criterion.key] ?? ''} placeholder="—" onChange={event => {
        setDraft(null); setMessage(''); setScores(current => ({ ...current, [criterion.key]: event.target.value }));
       }} />
      </div>
      <div className={styles.slider}>
       <span>0</span>
       <input aria-label={`${criterion.name}，左右拖动评分`} type="range" min={0} max={criterion.maxScore} step="0.01" value={value} style={{ '--fill': `${100 * value / criterion.maxScore}%` } as CSSProperties} onChange={event => {
        setDraft(null); setMessage(''); setScores(current => ({ ...current, [criterion.key]: Number(event.target.value).toFixed(2) }));
       }} />
       <span>{criterion.maxScore}</span>
      </div>
     </div>;
    })}
    <div className={styles.total}>
     <div className={styles.totalLine}>
      <label htmlFor="judge-total">{locked ? '总分' : '总分（可修改）'}</label>
      <input id="judge-total" type="number" inputMode="decimal" min={0} max={max} step="0.01" required value={displayTotal ?? ''} placeholder="—" onFocus={() => {
       weights.current = criteria.map(criterion => Number(scores[criterion.key]) || 0);
      }} onChange={event => editTotal(event.target.value)} />
      <span>/ {max}</span>
      {!locked && <label htmlFor="judge-total" className={styles.editIcon} aria-hidden="true"><PencilLine size={18} /></label>}
     </div>
     {!locked && <p>修改总分，各项按比例分配</p>}
    </div>
   </fieldset>
   {error && <p role="alert" className={styles.error}>{error}</p>}
   {message && <p role="status" className={styles.success}>{message}</p>}
   {!locked && <button type="submit" disabled={saving || !valid} className={styles.submit}>{saving ? '正在提交…' : submitted ? '修改评分' : '确认评分'}</button>}
   <p role={locked ? 'status' : undefined} className={styles.note}>{locked ? '该组别评分已锁定，只能查看' : '评分锁定后仅可查看'}</p>
  </form>
 </>;
}
