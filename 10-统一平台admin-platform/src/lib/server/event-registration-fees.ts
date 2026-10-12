export function recordRegistrationPayment(db: any, playerId: number, body: any) {
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
  const hasOrders=db.prepare("SELECT name FROM main.sqlite_master WHERE type='table' AND name='shop_course_orders'").get();
  if(hasOrders && kind==='charge') {
    const active=db.prepare("SELECT o.id FROM main.shop_online_orders o JOIN main.shop_course_orders c ON c.order_id=o.id WHERE c.kind='event' AND c.target_id=? AND o.status='pending'").get(playerId);
    if(active && active.id!==body.onlineOrderId) throw new Error('该报名正在在线缴费，请先处理在线订单');
  }
  const collected = Math.round(Number(player.paid_amount || 0)*100), fee = Math.round(Number(player.registration_fee || 0)*100);
  if (kind === 'charge' && ['cancelled','withdrawn'].includes(player.status)) throw new Error('已取消报名不能登记缴费');
  if (kind === 'charge' && (collected !== 0 || cents !== fee)) throw new Error('单条报名须一次缴清该组别报名费，不支持分次或合并缴费');
  if (kind === 'refund' && (collected <= 0 || cents !== collected)) throw new Error('单条报名退款须退还全部已收金额');
  const balance = collected + (kind === 'charge' ? cents : -cents);
  const status = balance === 0 ? (kind === 'refund' ? 'refunded' : 'unpaid') : 'paid';
  const now = new Date().toISOString();
  const result = db.prepare(`INSERT INTO event_registration_payments(competition_id,player_id,kind,amount,method,paid_at,remark,created_by,created_at,request_key) VALUES(?,?,?,?,?,?,?,?,?,?)`).run(player.competition_id,playerId,kind,cents/100,method,paidAt,remark,db.eventActorId || 0,now,key);
  db.prepare('UPDATE event_players SET paid_amount=?,paid_status=?,paid_at=?,payment_method=?,updated_at=? WHERE id=?').run(balance/100,status,kind === 'charge' ? paidAt : player.paid_at,kind === 'charge' ? method : player.payment_method,now,playerId);
  return { id: Number(result.lastInsertRowid), repeated: false };
}
