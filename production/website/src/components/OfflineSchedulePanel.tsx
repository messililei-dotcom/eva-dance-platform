"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { studentApi, type OfflineOverview } from '@/lib/student-api';
import { getStudentSession } from '@/lib/student-auth';
import { OPEN_STUDENT_LOGIN_EVENT } from '@/lib/ui-events';

type Tab = 'rights' | 'consumes';
const empty: OfflineOverview = {entitlements:[],sessions:[],bookings:[],consumes:[]};
const title = (r:any) => [r.course_name || '线下课程',r.course_period].filter(Boolean).join(' · ');
export default function OfflineSchedulePanel({activeTab,courseIds=[]}: {activeTab:Tab;courseIds?:number[];onTabChange:(tab:Tab)=>void}) {
 const [overview,setOverview]=useState<OfflineOverview>(empty),[loading,setLoading]=useState(false),[error,setError]=useState(''),[signedIn,setSignedIn]=useState(false);
 const version=useRef(0);const courseKey=courseIds.join(',');
 const load=useCallback(async()=>{const v=++version.current;const id=getStudentSession()?.id;setSignedIn(!!id);setOverview(empty);setError('');if(!id){setLoading(false);return;}setLoading(true);try{const next=await studentApi.getOfflineOverview(courseIds);if(v===version.current && id===getStudentSession()?.id)setOverview(next);}catch(e){if(v===version.current)setError(e instanceof Error?e.message:'课时加载失败');}finally{if(v===version.current)setLoading(false);}},[courseKey]);
 useEffect(()=>{void load();window.addEventListener('focus',load);window.addEventListener('student-auth-changed',load);return()=>{++version.current;window.removeEventListener('focus',load);window.removeEventListener('student-auth-changed',load);};},[load]);
 const rows=activeTab==='rights'?overview.entitlements:overview.consumes||[];
 return <section className="mx-auto max-w-5xl px-4 py-6">
  <div className="mb-5 flex items-center justify-between gap-4"><div><h2 className="text-xl font-bold">{activeTab==='rights'?'我的期次课时':'核销记录'}</h2><p className="mt-2 text-sm text-gray-500">购买课程期次的课时，到课后核销扣减，无需预约。</p></div><button onClick={()=>void load()} className="rounded-full border px-4 py-2">刷新</button></div>
  {!signedIn?<button onClick={()=>window.dispatchEvent(new Event(OPEN_STUDENT_LOGIN_EVENT))} className="rounded-full bg-[#9F1D20] px-5 py-3 text-white">登录查看已购课时</button>:loading?<p>课时数据加载中…</p>:error?<p role="alert">{error}</p>:!rows.length?<p>{activeTab==='rights'?'暂无已购课时，请先选择课程期次购买。':'暂无核销记录。'}</p>:<div className="grid gap-4 md:grid-cols-2">{rows.map((r:any)=><article key={r.id} className="rounded-2xl border bg-white p-5"><h3 className="font-semibold">{title(r)}</h3>{activeTab==='rights'?<><p className="mt-3">剩余 {r.available_sessions} 课时 · 已核销 {r.used_sessions} 课时</p><p className="mt-2 text-sm text-gray-500">有效期：{String(r.valid_until||'').slice(0,10)||'长期有效'}</p></>:<><p className="mt-3">{r.consume_date} · 核销 {r.count} 课时</p><p className="mt-2 text-sm text-gray-500">核销后剩余 {r.remaining_after} 课时</p></>}</article>)}</div>}
 </section>;
}
