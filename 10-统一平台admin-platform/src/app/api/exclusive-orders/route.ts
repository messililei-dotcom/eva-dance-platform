import {prepareExclusiveRefund,reconcileExclusiveRefund} from '@/lib/server/exclusive-refunds';
import {authPayloadFromRequest} from '../training-db';
import {shopDb,reconcileOrder} from '@/lib/server/shop-service';
import {ShopError} from '@/lib/server/shop-core';
import {ensureExclusive,exclusiveActor,createExclusive,adminExclusive,exclusiveAudit,catalogItem} from '@/lib/server/exclusive-orders';
export const dynamic='force-dynamic';
const json=(d:unknown,status=200)=>Response.json(d,{status,headers:{'Cache-Control':'private, no-store'}});
const fail=(e:unknown)=>json({error:e instanceof ShopError?e.message:'专属订单服务暂不可用'},e instanceof ShopError?e.status:503);
function read(request:Request,fn:(db:any,actor:any)=>any){return shopDb(db=>{ensureExclusive(db);const actor=exclusiveActor(db,authPayloadFromRequest(request));if(!actor.canView&&!actor.canCreate)throw new ShopError('没有订单权限',403);return fn(db,actor);});}
export async function GET(request:Request){try{
 const q=new URL(request.url).searchParams;
 return json(read(request,(db,a)=>{
  if(q.get('action')==='catalog'){
   const items=[];for(const [kind,table] of [['online','CourseSeries'],['offline','Course'],['goods','shop_products']])for(const row of db.prepare(`SELECT id FROM ${table}`).all()){try{items.push(catalogItem(db,kind,row.id));}catch{}}
   return{actor:{id:a.id,name:a.name,canChangeAdvisor:a.privileged},advisors:a.privileged?db.prepare("SELECT id,COALESCE(NULLIF(name,''),username) name FROM User WHERE status='active'").all():[{id:a.id,name:a.name}],items};
  }
  if(q.get('action')==='members'){
   const word=(q.get('q')||'').trim();return{members:word.length<2?[]:db.prepare('SELECT id,name,phone FROM Member WHERE name LIKE ? OR phone LIKE ? LIMIT 20').all('%'+word+'%','%'+word+'%')};
  }
  const rows=db.prepare('SELECT * FROM exclusive_orders ORDER BY created_at DESC LIMIT 300').all();
  const orders=rows.filter((o:any)=>a.privileged||o.creator_id===a.id||o.advisor_id===a.id).map((o:any)=>{
   const claims=db.prepare(`SELECT c.member_id,c.created_at,m.name customerName,m.phone customerPhone,p.id,p.status,p.total_fen,p.provider,p.transaction_id,p.created_at paymentCreatedAt,p.updated_at FROM exclusive_claims c JOIN Member m ON m.id=c.member_id JOIN shop_online_orders p ON p.id=c.payment_order_id WHERE c.exclusive_id=? ORDER BY c.created_at DESC`).all(o.id);
   for(const c of claims){c.refundedFen=db.prepare("SELECT COALESCE(SUM(amount_fen),0) n FROM exclusive_refunds WHERE order_id=? AND status='success'").get(c.id).n;c.displayStatus=c.refundedFen>=c.total_fen?'refunded':c.refundedFen>0?'partially_refunded':c.status;}
   const paid=claims.filter((c:any)=>c.transaction_id),refunded=db.prepare("SELECT COALESCE(SUM(amount_fen),0) n FROM exclusive_refunds WHERE exclusive_id=? AND status='success'").get(o.id).n;
   return{...adminExclusive(db,o),claims,paidCount:paid.length,paidFen:paid.reduce((n:number,c:any)=>n+c.total_fen,0),refundedFen:refunded,refunds:db.prepare('SELECT id,order_id,amount_fen,status,reason,actor,created_at FROM exclusive_refunds WHERE exclusive_id=? ORDER BY created_at DESC').all(o.id)};
  });return{orders,actor:{id:a.id,canCreate:a.canCreate,canRefund:a.privileged}};
 }));
}catch(e){return fail(e);}}
export async function POST(request:Request){try{
 if(request.headers.get('sec-fetch-site')==='cross-site')throw new ShopError('请求来源无效',403);
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin&&origin!=='https://admin.swod.com.cn')throw new ShopError('请求来源无效',403);
 const raw=await request.text();if(raw.length>20000)throw new ShopError('请求过大',413);const input=JSON.parse(raw);
 if(input.action==='create')return json(read(request,(db,a)=>adminExclusive(db,createExclusive(db,a,input))),201);
 const target=read(request,(db,a)=>{
  const o=db.prepare('SELECT * FROM exclusive_orders WHERE id=?').get(input.id);if(!o)throw new ShopError('订单不存在',404);
  if(input.action!=='share'&&!a.canCreate)throw new ShopError('没有修改订单权限',403);
  if(!a.privileged&&o.creator_id!==a.id&&!(input.action==='share'&&o.advisor_id===a.id))throw new ShopError('只有创建人或管理员可操作该订单',403);
  return{o,a};
 });
 if(input.action==='refund'){
  const refund=read(request,(db,a)=>{if(!a.privileged)throw new ShopError('仅管理员可执行原路退款',403);const link=db.prepare('SELECT exclusive_id FROM shop_order_advisors WHERE order_id=?').get(input.orderId);if(link?.exclusive_id!==target.o.id)throw new ShopError('客户订单不属于该卡片',404);return prepareExclusiveRefund(db,input.orderId,input.amountFen,String(input.reason||''),a.name,String(input.requestKey||''),input.returned===true);});
  await reconcileExclusiveRefund(refund.id);return json({success:true});
 }
 if(input.action==='cancel'){
  // Stop new confirmations before closing pending gateway transactions.
  read(request,(db,a)=>{db.prepare("UPDATE exclusive_orders SET status='cancelled' WHERE id=?").run(target.o.id);exclusiveAudit(db,target.o.id,'cancelled',String(a.id));});
  const ids=read(request,db=>db.prepare("SELECT p.id FROM exclusive_claims c JOIN shop_online_orders p ON p.id=c.payment_order_id WHERE c.exclusive_id=? AND p.status='pending'").all(target.o.id));
  for(const {id} of ids)await reconcileOrder(id,true);
 }else read(request,(db,a)=>{
  if(input.action==='publish'){
   if(target.o.status!=='draft')throw new ShopError('仅草稿可以发布');
   catalogItem(db,target.o.kind,target.o.target_id);if(target.o.expires_at&&target.o.expires_at<=Date.now()+120000)throw new ShopError('有效期已过，请重新开单');
   db.prepare("UPDATE exclusive_orders SET status='pending' WHERE id=?").run(target.o.id);
  }else if(input.action==='share'){if(target.o.status==='draft')throw new ShopError('请先发布订单');db.prepare('UPDATE exclusive_orders SET share_count=share_count+1 WHERE id=?').run(target.o.id);}
  else throw new ShopError('不支持的订单操作');
  exclusiveAudit(db,target.o.id,input.action,String(a.id));
 });
 return json({success:true});
}catch(e){return fail(e);}}
