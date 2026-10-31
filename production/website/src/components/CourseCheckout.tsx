'use client';
import {useCourseAccess} from './CourseAccess';
import {useEffect,useState,useRef} from 'react';
import StudentLoginModal from './StudentLoginModal';
import {studentApi} from '@/lib/student-api';
export default function CourseCheckout({kind,id}:{kind:'online'|'offline'|'event';id:string}){
 const [offer,setOffer]=useState<any>(null),[payment,setPayment]=useState<any>({}),[provider,setProvider]=useState('wechat'),[error,setError]=useState(''),[busy,setBusy]=useState(false),[login,setLogin]=useState(false);
 const access=useCourseAccess(kind==='online'?id:null);
 const lock=useRef(false);
 useEffect(()=>{let active=true;fetch(`/api/shop/courses/${kind}/${encodeURIComponent(id)}`,{cache:'no-store',headers:studentApi.getToken()?{Authorization:`Bearer ${studentApi.getToken()}`}:{}}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);return d;}).then(d=>{if(active){setOffer(d.offer);setPayment(d.payment);if(!d.payment.wechat)setProvider('alipay');}}).catch(e=>{if(active)setError(e.message)});return()=>{active=false;};},[kind,id]);
 async function submit(){
  if(lock.current || !offer)return;
  if(kind==='online' && (access.hideSales || access.unlocked))return;
  if(!studentApi.getToken()){setLogin(true);return;}
  lock.current=true;setBusy(true);setError('');
  try{
   const input={kind,targetId:id,provider,expectedTotalFen:offer.priceFen};const fingerprint=JSON.stringify(input),key='eva-course-checkout';let saved;
   try{saved=JSON.parse(sessionStorage.getItem(key)||'null')}catch{}
   if(!saved || saved.fingerprint!==fingerprint){saved={fingerprint,requestKey:crypto.randomUUID()};sessionStorage.setItem(key,JSON.stringify(saved));}
   const r=await fetch('/api/shop/orders',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${studentApi.getToken()}`},body:JSON.stringify({...input,requestKey:saved.requestKey})});const d=await r.json();
   if(r.status===401){setLogin(true);throw new Error('请登录后继续');}if(!r.ok)throw new Error(d.error || '下单失败');
   sessionStorage.removeItem(key);window.location.assign('/shop/selection?order='+encodeURIComponent(d.order.id)+'&pay=1');
  }catch(e:any){setError(e.message)}finally{lock.current=false;setBusy(false)}
 }
 if(kind==='online' && access.unlocked)return <main className="mx-auto max-w-xl px-5 py-12"><p className="font-semibold text-green-700">✓ 已解锁</p><a className="mt-4 inline-flex rounded-xl bg-emerald-900 px-6 py-3 text-white" href={`/courses/${encodeURIComponent(id)}/videos?source=platform`}>继续学习</a></main>;
 if(kind==='online' && access.hideSales)return <main className="mx-auto max-w-xl px-5 py-12" role="status">{access.pending?'正在查询学习权益…':'暂无法确认学习权益，请刷新后重试'}</main>;
 return <main className="mx-auto max-w-xl px-5 py-12"><h1 className="mb-6 text-2xl font-semibold">{kind==='event'?'确认报名缴费':'确认课程订单'}</h1>{error&&<p role="alert" className="my-4 text-red-700">{error}</p>}{offer&&<div className="space-y-5 rounded-2xl border bg-white p-6"><h2 className="text-xl">{offer.name}</h2><p>{offer.period}</p><p>{kind==='event'?'单条报名须一次缴清所选组别报名费。支付确认后自动更新赛事缴费记录。':kind==='online'?'付款后自动开通本账号的课程学习权限。':'付款后开通所选期次的课次，可在个人中心预约上课。'}</p><p className="text-2xl">¥{(offer.priceFen/100).toFixed(2)}</p><fieldset className="flex gap-6"><legend className="mb-3">支付方式</legend>{['wechat','alipay'].filter(p=>payment[p]).map(p=><label key={p}><input type="radio" checked={provider===p} onChange={()=>setProvider(p)}/>{p==='wechat'?'微信支付':'支付宝'}</label>)}</fieldset><button disabled={busy||!payment[provider]} onClick={submit} className="w-full rounded-xl bg-emerald-900 px-6 py-3 text-white disabled:opacity-50">{busy?'正在提交…':'下单并支付'}</button><a href="/shop/selection?orders=1" className="block text-center underline">我的订单／继续付款</a></div>}<StudentLoginModal open={login} onClose={()=>setLogin(false)} onSuccess={()=>{setLogin(false);}}/></main>
}
