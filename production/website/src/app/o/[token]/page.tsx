import {shopDb} from '@/lib/server/shop-service';
import {ensureExclusive,findExclusive,publicExclusive} from '@/lib/server/exclusive-orders';
import {buildShareMetadata} from '@/lib/share-metadata';
import ExclusiveOrder from '@/components/ExclusiveOrder';
export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{token:string}>}){const {token}=await params;try{const o=shopDb(db=>{ensureExclusive(db);return publicExclusive(db,findExclusive(db,token));});return{...buildShareMetadata({title:'伊娃东方舞 · 官方订单',shareTitle:o.title,description:`应付 ¥${(o.totalFen/100).toFixed(2)} · 顾问 ${o.advisor} · 查看订单并支付`,path:`/o/${token}`,image:`/api/exclusive/${token}/card`}),robots:{index:false,follow:false},referrer:'no-referrer'};}catch{return{title:'专属订单暂不可用',robots:{index:false,follow:false}};}}
export default async function Page({params}:{params:Promise<{token:string}>}){const {token}=await params;return <ExclusiveOrder token={token}/>;}
