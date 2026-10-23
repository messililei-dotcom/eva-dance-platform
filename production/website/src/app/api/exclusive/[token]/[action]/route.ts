import {exclusiveArtwork} from '@/lib/server/exclusive-artwork';
import {shopDb,reconcileOrder} from '@/lib/server/shop-service';
import {ensureExclusive,findExclusive,publicExclusive,claimExclusive,exclusiveAudit} from '@/lib/server/exclusive-orders';
import {ShopError,orderById,publicOrder} from '@/lib/server/shop-core';
import {paymentAvailability} from '@/lib/server/shop-payments';
import {getAuthenticatedMemberId,getAuthenticatedMemberIdentity,normalizePhoneNumber} from '@/app/api/mini/_helpers';
import {saveShipping} from '@/lib/server/shop-shipping';
export const dynamic='force-dynamic';
export const runtime='nodejs';
type C={params:Promise<{token:string;action:string}>};
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex'}});
function fail(e:unknown){return json({error:e instanceof ShopError?e.message:'订单服务暂不可用'},e instanceof ShopError?e.status:503);}
export async function GET(request:Request,c:C){try{const {token,action}=await c.params;if(['card','qr'].includes(action)){const o=shopDb(db=>{ensureExclusive(db);return publicExclusive(db,findExclusive(db,token));});return new Response(new Uint8Array(await exclusiveArtwork(o,token,action==='qr')),{headers:{'Access-Control-Allow-Origin':'https://admin.swod.com.cn','Content-Type':'image/png','Cache-Control':'private, no-store','X-Robots-Tag':'noindex','Referrer-Policy':'no-referrer'}});}
 if(action!=='view')return json({error:'接口不存在'},404);
 return json(shopDb(db=>{ensureExclusive(db);const o=findExclusive(db,token);db.prepare('UPDATE exclusive_orders SET first_opened_at=? WHERE id=? AND first_opened_at=0').run(Date.now(),o.id);const member=getAuthenticatedMemberId(request);const claim=member?db.prepare('SELECT payment_order_id FROM exclusive_claims WHERE exclusive_id=? AND member_id=?').get<{payment_order_id:string}>(o.id,member):null;const customer=member?db.prepare('SELECT phone FROM Member WHERE id=?').get<{phone:string}>(member):null;const intended=member&&(o.customer_id===member||(o.customer_phone&&normalizePhoneNumber(customer?.phone)===o.customer_phone));return{prefillShipping:intended?JSON.parse(o.shipping):null,order:publicExclusive(db,o),payment:paymentAvailability(),myOrder:claim?publicOrder(db,orderById(db,claim.payment_order_id,member)):null};}));
}catch(e){return fail(e);}}
export async function POST(request:Request,c:C){try{
 const origin=request.headers.get('origin');if(request.headers.get('sec-fetch-site')==='cross-site'||(origin!==new URL(request.url).origin&&origin!=='https://www.swod.com.cn'))throw new ShopError('请求来源无效',403);
 const {token,action}=await c.params;if(action!=='confirm')throw new ShopError('接口不存在',404);
 const memberId=getAuthenticatedMemberId(request);if(!memberId)throw new ShopError('请先验证手机号登录',401);
 const raw=await request.text();if(raw.length>8000)throw new ShopError('请求过大',413);const input=JSON.parse(raw);
 const availability=paymentAvailability();if(!['wechat','alipay'].includes(input.provider)||!availability[input.provider as 'wechat'|'alipay'])throw new ShopError('所选支付方式暂未开通',409);
 // Bind to the phone carried by the validated login session, not an editable form field.
 const identity=getAuthenticatedMemberIdentity(request);const phone=normalizePhoneNumber(identity?.phone);if(identity?.id!==memberId)throw new ShopError('请重新登录',401);
 const existing=shopDb(db=>{ensureExclusive(db);const o=findExclusive(db,token);const m=db.prepare('SELECT phone FROM Member WHERE id=?').get<{phone:string}>(memberId);if(!phone||phone!==normalizePhoneNumber(m?.phone))throw new ShopError('请通过手机号验证码登录后再确认订单',401);return db.prepare('SELECT payment_order_id FROM exclusive_claims WHERE exclusive_id=? AND member_id=?').get<{payment_order_id:string}>(o.id,memberId);});
 if(existing)await reconcileOrder(existing.payment_order_id);
 const order=shopDb(db=>db.transaction(()=>{const o=findExclusive(db,token);const result=claimExclusive(db,o,memberId,input);if(o.kind==='goods')saveShipping(db,memberId,input.shipping||JSON.parse(o.shipping));return result;})());
 return json({order},201);
}catch(e){return fail(e);}}
