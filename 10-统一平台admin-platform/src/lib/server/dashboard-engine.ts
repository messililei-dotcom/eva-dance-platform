import { AUTHORIZATION_FINANCIAL_SQL } from './authorization-revenue';
import type { AdminDb } from '@/lib/server/admin-db';
type Row = {id:string; date:string; member:number; name:string; course:string; business:string; channel:string; advisor:string; amount:number|null; commission:number; deal:boolean; status:string; href:string};
const round=(v:number)=>Math.round(v*100)/100;
const date=(v:unknown)=>String(v||'').slice(0,10);
const valid=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
const shift=(v:string,n:number)=>new Date(Date.parse(v+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
const yearBack=(v:string)=>{const y=Number(v.slice(0,4))-1,m=Number(v.slice(5,7)),d=Number(v.slice(8));return `${y}-${String(m).padStart(2,'0')}-${String(Math.min(d,new Date(Date.UTC(y,m,0)).getUTCDate())).padStart(2,'0')}`;};
export function period(p:URLSearchParams,today:string){
 const mode=p.get('mode')||'month';let start:string,end:string;
 if(mode==='custom'){start=p.get('start')||'';end=p.get('end')||'';}
 else if(mode==='year'){const y=p.get('value')||today.slice(0,4);start=y+'-01-01';end=y===today.slice(0,4)?today:y+'-12-31';}
 else {const m=p.get('value')||today.slice(0,7);start=m+'-01';end=m===today.slice(0,7)?today:valid(start)?new Date(Date.UTC(Number(m.slice(0,4)),Number(m.slice(5,7)),0)).toISOString().slice(0,10):'';}
 if(!valid(start)||!valid(end)||start>end||end>today||Number(start.slice(0,4))<2000||Date.parse(end)-Date.parse(start)>366*86400000)throw Error('请选择有效日期，范围不超过一年且不晚于今天');
 const days=Math.round((Date.parse(end)-Date.parse(start))/86400000)+1;
 let previousStart=shift(start,-days),previousEnd=shift(start,-1);
 if(mode==='month'){const d=new Date(start+'T00:00:00Z');d.setUTCMonth(d.getUTCMonth()-1);previousStart=d.toISOString().slice(0,10);previousEnd=shift(previousStart,Math.min(days,Math.round((Date.parse(start)-Date.parse(previousStart))/86400000))-1);}
 if(mode==='year'){previousStart=yearBack(start);previousEnd=yearBack(end);}
 return {mode,start,end,previousStart,previousEnd,yearStart:yearBack(start),yearEnd:yearBack(end),today};
}
export function dashboard(db:AdminDb,p:URLSearchParams,today=new Date(Date.now()+8*3600000).toISOString().slice(0,10)){
 const range=period(p,today);
 const members=db.prepare('SELECT id,name,phone,status,register_date,created_at,merged_to_member_id,remark FROM Member').all<any>();
 const byId=new Map<number,any>(members.map(m=>[Number(m.id),m]));
 const canonical=(id:number)=>{const seen=new Set<number>();while(byId.has(id)&&!seen.has(id)){seen.add(id);const m=byId.get(id);const next=Number(m.merged_to_member_id)||Number(String(m.remark||'').match(/merged_into:(\d+)/)?.[1]);if(!next)break;id=next;}return id;};
 const hasOrderAdvisors=!!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='shop_order_advisors'").get();
 const orderAdvisors=new Map<string,string>(hasOrderAdvisors?db.prepare('SELECT order_id,advisor_name FROM shop_order_advisors').all<any>().map(r=>[r.order_id,r.advisor_name]):[]);
 const advisor=(s:unknown)=>String(s||'').trim()||'未归属';
 const rows:Row[]=[];
 const add=(r:Row)=>rows.push({...r,member:canonical(r.member)});
 db.prepare('SELECT * FROM Payment').all<any>().forEach(r=>add({id:`PAY-${r.id}`,date:date(r.date),member:r.memberId,name:r.memberName,course:r.courseName||'未命名课程',business:'线下',channel:'线下缴费',advisor:advisor(r.sales),amount:['paid','completed'].includes(r.paymentStatus)?Number(r.amount):null,commission:['paid','completed'].includes(r.paymentStatus)?Number(r.commissionAmount??Number(r.amount)*Number(r.commissionRate||0)/100):0,deal:['paid','completed'].includes(r.paymentStatus)&&Number(r.amount)>0,status:r.paymentStatus,href:'/training?tab=payments'}));
 db.prepare(`SELECT * FROM (${AUTHORIZATION_FINANCIAL_SQL}) WHERE standalone=1`).all<any>().forEach(r=>add({id:`AUTH-${r.id}`,date:date(r.granted_at),member:r.member_id||0,name:r.memberName||r.phone||'未关联学员',course:r.course,business:'线上',channel:r.course.includes('成品舞')?'成品舞授权':'系统课程授权',advisor:advisor(r.sales),amount:r.actual_amount==null?null:Number(r.actual_amount),commission:Number(r.commission_amount||0),deal:false,status:r.status,href:'/online-course/auth'}));
 db.prepare("SELECT o.*,s.name course,m.name memberName FROM CourseOrder o LEFT JOIN CourseSeries s ON s.id=o.series_id LEFT JOIN Member m ON m.id=o.member_id WHERE o.status IN ('paid','completed')").all<any>().forEach(r=>add({id:`COURSE-${r.id}`,date:date(r.paid_at),member:r.member_id,name:r.memberName||'未关联学员',course:r.course||'线上课程',business:'线上',channel:orderAdvisors.has(r.order_no)?'顾问专属订单':'线上订单',advisor:advisor(orderAdvisors.get(r.order_no)),amount:Number(r.amount),commission:0,deal:Number(r.amount)>0,status:r.status,href:'/orders'}));
 const otherOrders=db.prepare("SELECT o.* FROM orders o WHERE o.status IN ('paid','completed') AND NOT (o.source_type IN ('offline-training','offline_payment') AND EXISTS(SELECT 1 FROM Payment p WHERE CAST(p.id AS TEXT)=o.source_id)) AND NOT (o.source_type IN ('online_course_order','online_course') AND EXISTS(SELECT 1 FROM CourseOrder c WHERE CAST(c.id AS TEXT)=o.source_id))").all<any>();
 otherOrders.forEach(r=>add({id:`ORDER-${r.id}`,date:date(r.paid_at||r.created_at),member:r.member_id,name:r.member_name||'未关联学员',course:r.title||'未命名课程',business:['lizhi','online_course','online_course_order'].includes(r.source_type)?'线上':['offline-training','offline_payment'].includes(r.source_type)?'线下':'其他',channel:r.source_type==='lizhi'?'荔枝微课':['offline-training','offline_payment'].includes(r.source_type)?'历史线下订单':r.source_type||'其他订单',advisor:'未归属',amount:Number(r.amount),commission:0,deal:Number(r.amount)>0,status:r.status,href:'/orders'}));
 const first=new Map<number,string>();rows.filter(r=>r.amount!=null&&r.amount>0&&r.member&&valid(r.date)).forEach(r=>{if(!first.has(r.member)||r.date<first.get(r.member)!)first.set(r.member,r.date);});
 const business=p.get('business')||'全部',who=p.get('advisor')||'全部',channel=p.get('channel')||'全部';
 const scoped=rows.filter(r=>(business==='全部'||r.business===business)&&(who==='全部'||r.advisor===who)&&(channel==='全部'||r.channel===channel));
 const between=(rs:Row[],s:string,e:string)=>rs.filter(r=>valid(r.date)&&r.date>=s&&r.date<=e);
 // Zero-receipt online grants remain available for gift auditing, not income analysis.
 const incomeRows=(rs:Row[])=>rs.filter(r=>!(r.business==='线上'&&r.amount===0));
 const sum=(rs:Row[])=>{
  const paid=rs.filter(r=>r.amount!=null&&r.amount>0),buyers=new Set(paid.filter(r=>r.member).map(r=>r.member));
  const fresh=new Set(paid.filter(r=>r.member&&first.get(r.member)!>=range.start&&first.get(r.member)!<=range.end).map(r=>r.member));
  return {revenue:round(rs.reduce((v,r)=>v+(r.amount||0),0)),commission:round(incomeRows(rs).reduce((v,r)=>v+r.commission,0)),deals:paid.filter(r=>r.deal).length,authorizations:paid.filter(r=>!r.deal).length,buyers:buyers.size,newBuyers:fresh.size,oldRevenue:round(paid.filter(r=>r.member&&first.get(r.member)!<range.start).reduce((v,r)=>v+r.amount!,0)),gifts:rs.filter(r=>r.amount===0).length,missing:rs.filter(r=>r.amount===null).length};
 };
 const current=between(scoped,range.start,range.end);
 const stats=(rs:Row[],start:string,end:string)=>{const s=sum(rs);s.newBuyers=new Set(rs.filter(r=>r.amount!>0&&r.member&&first.get(r.member)!>=start&&first.get(r.member)!<=end).map(r=>r.member)).size;s.oldRevenue=round(rs.filter(r=>r.amount!>0&&r.member&&first.get(r.member)!<start).reduce((v,r)=>v+r.amount!,0));return {...s,average:s.buyers?round(rs.filter(r=>r.member&&r.amount!>0).reduce((v,r)=>v+r.amount!,0)/s.buyers):0};};
 const group=(key:'advisor'|'course'|'business')=>{const eligible=incomeRows(current);const keys=[...new Set(eligible.map(r=>r[key]))];return keys.map(name=>{const rs=eligible.filter(r=>r[key]===name);return {name,...stats(rs,range.start,range.end),online:round(rs.filter(r=>r.business==='线上').reduce((v,r)=>v+(r.amount||0),0)),offline:round(rs.filter(r=>r.business==='线下').reduce((v,r)=>v+(r.amount||0),0))};}).sort((a,b)=>b.revenue-a.revenue);};
 const registrations=members.filter(m=>canonical(m.id)===m.id&&!['deleted','merged'].includes(m.status)&&valid(date(m.register_date)));
 const trend:Array<ReturnType<typeof stats> & {key:string;label:string;yearRevenue:number|null;registered:number;yearRegistered:number|null}>=[];const bucket=range.mode==='year'?'month':'day';
 for(let d=range.start;d<=range.end;d=shift(d,1)){
  const key=bucket==='month'?d.slice(0,7):d;
  if(trend.some((t:any)=>t.key===key))continue;
  const end=bucket==='month'?[new Date(Date.UTC(Number(d.slice(0,4)),Number(d.slice(5,7)),0)).toISOString().slice(0,10),range.end].sort()[0]:d;
  const cy=between(scoped,d,end),py=between(scoped,yearBack(d),yearBack(end));
  trend.push({key,label:bucket==='month'?d.slice(5,7)+'月':d.slice(5),...stats(cy,d,end),yearRevenue:py.length?sum(py).revenue:null,registered:registrations.filter(m=>date(m.register_date)>=d&&date(m.register_date)<=end).length,yearRegistered:registrations.some(m=>date(m.register_date)<=yearBack(end))?registrations.filter(m=>date(m.register_date)>=yearBack(d)&&date(m.register_date)<=yearBack(end)).length:null});
 }
 const notices=[
  '实收按已付款线下缴费、独立线上订单、实收大于零的线上授权及历史订单汇总；关联的财务收入不重复相加。实收为0的线上课程不列入收入明细和业绩统计，仅保留在赠课核查中。取消授权不等同退款。',
  '付费授权可能来自套餐拆分，单列授权记录数，不混入确认成交笔数；缺失实收不按零元或标价补算。',
  '首次付费依据系统已知历史；同一学员跨渠道去重。早期交易缺失会影响首次付费和复购判断。客单价仅计算已关联学员的付费收入与去重人数，未关联记录不参与分子或分母。',
  '顾问按原始名称展示，别名未核准前不合并；未归属收入单列。提成是记录金额，不代表已发放。',
  '荔枝微课历史与新授权缺少统一交易关联，跨系统重叠仍需核对；当前展示已知记录汇总，不作为最终财务结算依据。',
  '退款数据尚不足以确认完整覆盖，因此本页展示实收收入，不展示净实收或利润。',
 ];
 const breakdown=p.get('detailBy'),name=p.get('detailName');
 let details=current.filter(r=>!breakdown||!name||r[breakdown as 'advisor'|'course'|'business']===name);
 const metric=p.get('metric');if(metric!=='gifts')details=incomeRows(details);if(metric==='missing')details=details.filter(r=>r.amount==null);if(metric==='gifts')details=details.filter(r=>r.amount===0);if(metric==='unassigned')details=details.filter(r=>r.advisor==='未归属');
 details.sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
 const page=Math.max(1,Math.min(100000,Number(p.get('page'))||1));
 return {range,updatedAt:new Date().toISOString(),filters:{advisors:[...new Set(rows.map(r=>r.advisor))].sort(),channels:[...new Set(rows.map(r=>r.channel))].sort()},stats:stats(current,range.start,range.end),previous:stats(between(scoped,range.previousStart,range.previousEnd),range.previousStart,range.previousEnd),year:stats(between(scoped,range.yearStart,range.yearEnd),range.yearStart,range.yearEnd),trend,advisors:group('advisor'),courses:group('course'),businesses:group('business'),registrations:registrations.filter(m=>date(m.register_date)>=range.start&&date(m.register_date)<=range.end).length,registrationUnknown:members.filter(m=>canonical(m.id)===m.id&&!valid(date(m.register_date))).length,unassigned:current.filter(r=>r.advisor==='未归属').length,invalidDates:scoped.filter(r=>!valid(r.date)).length,notices,comparisonLimited:!scoped.some(r=>r.amount!=null&&valid(r.date)&&r.date<=range.yearEnd)||scoped.some(r=>r.id.startsWith('AUTH-')),details:details.slice((page-1)*25,page*25),detailTotal:details.length,page};
}
