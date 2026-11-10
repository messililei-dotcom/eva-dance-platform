import { findPhoneMembers, samePhoneIdentity } from './event-phone-member';
import type { AdminDb } from "./admin-db";
export function ensurePhoneMember(db: any, name: string, contact: string, source: string) {
  const columns = new Set(db.prepare('PRAGMA main.table_info(Member)').all().map((r: any) => r.name));
  const normalizeSql = (column: string) => {
    const digits = `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(${column}, ''), '+', ''), ' ', ''), '-', ''), '(', ''), ')', '')`;
    return `(CASE WHEN length(${digits})=13 AND substr(${digits},1,2)='86' THEN substr(${digits},3) ELSE ${digits} END)`;
  };
  const lookupContact = contact.replace(/\D/g, '');
  const matches = findPhoneMembers(db, contact);
  // Older event imports kept the contact phone only on registrations/judges.
  // Reuse their linked profile when no unified profile has that phone yet.
  if (!matches.length) {
    matches.push(...db.prepare(`SELECT DISTINCT m.id,e.phone FROM main.Member m JOIN (
      SELECT member_id,phone FROM main.event_players WHERE ${normalizeSql('phone')}=? AND member_id>0
      UNION SELECT member_id,phone FROM main.event_judges WHERE ${normalizeSql('phone')}=? AND member_id>0
    ) e ON e.member_id=m.id WHERE COALESCE(m.status,'active')!='deleted'`).all(lookupContact, lookupContact).filter((row: any) => samePhoneIdentity(row.phone, contact)));
  }
  const ids = new Set<number>();
  for (const match of matches) {
    let id = Number(match.id);
    const visited = new Set<number>();
    while (columns.has('merged_to_member_id')) {
      if (visited.has(id)) throw new Error('手机号关联的人员合并记录异常，请先核对');
      visited.add(id);
      const next = Number(db.prepare('SELECT merged_to_member_id FROM main.Member WHERE id=?').get(id)?.merged_to_member_id || 0);
      if (!next) break;
      if (!db.prepare('SELECT id FROM main.Member WHERE id=?').get(next)) throw new Error('手机号关联的人员记录不存在');
      id = next;
    }
    ids.add(id);
  }
  if (ids.size > 1) throw new Error('手机号匹配到多个人员，请先合并或核对数据库');
  let memberId = [...ids][0];
  if (!memberId) {
    const values: Record<string, unknown> = { name, phone: contact, gender: '女', level: '体验学员', register_date: new Date().toISOString().slice(0,10), country: '中国', source, status: 'active', remark: source === 'event_judge' ? '赛事评委' : '赛事参赛学员' };
    const names = Object.keys(values).filter(key => columns.has(key));
    memberId = Number(db.prepare(`INSERT INTO Member (${names.join(',')}) VALUES (${names.map(() => '?').join(',')})`).run(...names.map(key => values[key])).lastInsertRowid);
  }
  if (db.eventOwnerId) db.prepare('INSERT OR IGNORE INTO temp.event_owned_members(id) VALUES (?)').run(memberId);
  return memberId;
}

export function recordRegistrationPayment(db: any, playerId: number, body: any, onlineOrderId?: string) {
  const player = db.prepare('SELECT * FROM event_players WHERE id=?').get(playerId);
  if (!player) throw new Error('报名不存在');
  const kind = body.kind;
  if (!['charge','refund'].includes(kind)) throw new Error('请选择缴费或退款登记');
  const raw = Number(body.amount), cents = Math.round(raw * 100);
  if (!Number.isFinite(raw) || cents <= 0 || Math.abs(raw * 100 - cents) > 0.000001) throw new Error('金额必须大于0且最多两位小数');
  const key = String(body.requestKey || '').trim();
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(key)) throw new Error('缺少有效的登记编号，请重新打开登记窗口');
  const date = new Date(body.paidAt);
  if (!Number.isFinite(date.getTime()) || date.getTime() > Date.now() + 60000) throw new Error('请填写有效的实际缴费或退款时间');
  const paidAt = date.toISOString(), method = String(body.method || '').trim(), remark = String(body.remark || '').trim();
  if (!['wechat','alipay','bank','cash','other'].includes(method)) throw new Error('请选择缴费方式');
  const prior = db.prepare('SELECT * FROM event_registration_payments WHERE competition_id=? AND request_key=?').get(player.competition_id,key);
  if (prior) {
    if (prior.player_id !== playerId || prior.kind !== kind || Math.round(prior.amount*100) !== cents || prior.paid_at !== paidAt || prior.method !== method || prior.remark !== remark) throw new Error('登记编号已使用，请重新打开窗口');
    return { id: prior.id, repeated: true };
  }
  const activeOrder = eventPaymentOrder(db, playerId, kind === 'charge' ? ['pending'] : ['completed', 'refund_requested', 'refunding']);
  if (activeOrder && activeOrder.id !== onlineOrderId) throw new Error('请在原在线订单中处理缴费或退款');
  const collected = Math.round(Number(player.paid_amount || 0)*100), fee = Math.round(Number(player.registration_fee || 0)*100);
  if (kind === 'charge' && ['cancelled','withdrawn'].includes(player.status)) throw new Error('已取消报名不能登记缴费');
  if (kind === 'charge' && (collected !== 0 || cents !== fee)) throw new Error('单条报名须一次缴清该组别报名费，不支持分次缴费');
  if (kind === 'refund' && (collected <= 0 || cents !== collected)) throw new Error('单条报名退款须退还全部已收金额');
  const balance = collected + (kind === 'charge' ? cents : -cents);
  const status = balance === 0 ? (kind === 'refund' ? 'refunded' : 'unpaid') : 'paid';
  const now = new Date().toISOString();
  const result = db.prepare(`INSERT INTO event_registration_payments(competition_id,player_id,kind,amount,method,paid_at,remark,created_by,created_at,request_key) VALUES(?,?,?,?,?,?,?,?,?,?)`).run(player.competition_id,playerId,kind,cents/100,method,paidAt,remark,db.eventActorId || 0,now,key);
  db.prepare('UPDATE event_players SET paid_amount=?,paid_status=?,paid_at=?,payment_method=?,updated_at=? WHERE id=?').run(balance/100,status,kind === 'charge' ? paidAt : player.paid_at,kind === 'charge' ? method : player.payment_method,now,playerId);
  return { id: Number(result.lastInsertRowid), repeated: false };
}

export function ensureEventOnline(db: AdminDb) {
 const cols=db.prepare('PRAGMA table_info(event_players)').all<{name:string}>();
 if(!cols.some(c=>c.name==='submitted_by_member_id')) db.exec('ALTER TABLE event_players ADD COLUMN submitted_by_member_id INTEGER NOT NULL DEFAULT 0');
 if (!cols.some(c => c.name === 'registration_batch_id')) db.exec('ALTER TABLE event_players ADD COLUMN registration_batch_id INTEGER NOT NULL DEFAULT 0');
 db.exec(`CREATE TABLE IF NOT EXISTS event_registration_batches (
   id INTEGER PRIMARY KEY AUTOINCREMENT, member_id INTEGER NOT NULL, competition_id INTEGER NOT NULL,
   request_key TEXT NOT NULL, request_hash TEXT NOT NULL, response TEXT NOT NULL DEFAULT '',
   UNIQUE(member_id, competition_id, request_key)
 );
 CREATE INDEX IF NOT EXISTS idx_event_players_registration_batch ON event_players(registration_batch_id) WHERE registration_batch_id > 0;`);
}
export function eventPaymentOrder(db: AdminDb, playerId: number, statuses: string[]) {
 if (!db.prepare("SELECT 1 FROM main.sqlite_master WHERE name='shop_course_orders'").get()) return undefined;
 return db.prepare(`SELECT o.id, o.member_id, o.status, o.total_fen, o.provider
   FROM main.shop_online_items i JOIN main.shop_online_orders o ON o.id=i.order_id
   JOIN main.shop_course_orders c ON c.order_id=o.id AND c.kind='event'
   WHERE i.product_id=? AND o.status IN (${statuses.map(() => '?').join(',')})
   ORDER BY o.created_at DESC LIMIT 1`).get<{ id: string; member_id: number; status: string; total_fen: number; provider: string }>('event:' + playerId, ...statuses);
}
export function eventPaymentOffer(db: AdminDb, id:number, actor:number) {
 const p=db.prepare(`SELECT p.*,g.name group_name,c.name competition_name FROM event_players p JOIN event_groups g ON g.id=p.group_id JOIN event_competitions c ON c.id=p.competition_id WHERE p.id=?`).get<any>(id);
 if (!p || !actor || (p.submitted_by_member_id !== actor && (p.registration_batch_id || p.member_id !== actor))) throw new Error('报名不存在');
 if(['cancelled','withdrawn'].includes(p.status) || p.audit_status==='rejected') throw new Error('该报名不能缴费');
 if(p.paid_amount>0 || ['paid','completed'].includes(p.paid_status)) throw new Error('该报名已经缴费');
 const priceFen=Math.round(Number(p.registration_fee)*100);
 if(!Number.isSafeInteger(priceFen)||priceFen<=0)throw new Error('该组别无需缴费');
 const rows = p.registration_batch_id ? db.prepare(`SELECT p.id,p.name,g.name AS group_name,p.registration_fee
   FROM event_players p JOIN event_groups g ON g.id=p.group_id
   WHERE p.registration_batch_id>0 AND p.registration_batch_id=? AND p.submitted_by_member_id=? AND p.competition_id=?
     AND p.registration_fee>0 AND COALESCE(p.paid_amount,0)=0 AND p.paid_status NOT IN ('paid','completed')
     AND p.status NOT IN ('cancelled','withdrawn') AND p.audit_status!='rejected' ORDER BY p.id`).all<any>(p.registration_batch_id, actor, p.competition_id) : [p];
 const eventItems = rows.map(row => ({ id: Number(row.id), name: row.group_name, participant: row.name, priceFen: Math.round(Number(row.registration_fee) * 100) }));
 const total = eventItems.reduce((sum, item) => sum + item.priceFen, 0);
 if (!eventItems.some(item => item.id === id) || !Number.isSafeInteger(total) || eventItems.some(item => item.priceFen <= 0)) throw new Error('报名费用无效');
 return {
   kind: 'event', id: eventItems[0].id, name: p.competition_name, period: '', priceFen: total, eventItems,
   image: '', description: '', sessions: 0, expires: '', capacity: 0, remaining: 0,
 };
}
export function settleEventPayment(db: AdminDb, order: any, refund = false) {
 const items = db.prepare('SELECT product_id, quantity, unit_fen FROM shop_online_items WHERE order_id=?').all<{ product_id: string; quantity: number; unit_fen: number }>(order.id);
 if (!items.length || items.some(item => !/^event:[1-9]\d*$/.test(item.product_id) || item.quantity !== 1 || !Number.isSafeInteger(item.unit_fen) || item.unit_fen <= 0) ||
   items.reduce((total, item) => total + item.unit_fen, 0) !== order.total_fen) throw new Error('报名订单金额明细不匹配');
 const paidAt = new Date().toISOString();
 for (const item of items) {
   const playerId = Number(item.product_id.slice(6));
   const player = db.prepare('SELECT * FROM event_players WHERE id=?').get<any>(playerId);
   if (!player || (player.submitted_by_member_id !== order.member_id && (player.registration_batch_id || player.member_id !== order.member_id))) throw new Error('报名付款人不匹配');
   recordRegistrationPayment(db, playerId, {
     kind: refund ? 'refund' : 'charge', amount: item.unit_fen / 100, method: order.provider, paidAt,
     remark: '在线支付订单 ' + order.id, requestKey: order.id + '-' + playerId + (refund ? '-refund' : '-charge'),
   }, order.id);
 }
}
