import type { AdminDb } from './admin-db';
import { AUTHORIZATION_FINANCIAL_SQL, MANUAL_INCOME_PREDICATE } from './authorization-revenue';
import { normalizeMemberPhone } from '../member-phone-search';

// Use source receipts, excluding their mirrored order/finance rows. Online shop
// callbacks write shop_sales, including negative refund offsets, so count it once.
export const MEMBER_SPENDING_SQL = `
 SELECT memberId AS member_id, memberPhone AS phone, amount FROM Payment
 WHERE paymentStatus IN ('paid','completed')
 UNION ALL
 SELECT member_id, memberPhone, actual_amount FROM (${AUTHORIZATION_FINANCIAL_SQL}) WHERE standalone=1 AND actual_amount>0
 UNION ALL
 SELECT member_id, '', amount FROM CourseOrder WHERE status IN ('paid','completed')
 UNION ALL
 SELECT o.member_id, o.member_phone, o.amount FROM orders o
 WHERE o.status IN ('paid','completed')
 AND NOT (o.source_type IN ('offline-training','offline_payment')
   AND EXISTS (SELECT 1 FROM Payment p WHERE CAST(p.id AS TEXT)=o.source_id))
 AND NOT (o.source_type IN ('online_course_order','online_course')
   AND EXISTS (SELECT 1 FROM CourseOrder co WHERE CAST(co.id AS TEXT)=o.source_id))
 UNION ALL
 SELECT member_id, customer_phone, total_amount FROM shop_sales
 UNION ALL
 SELECT memberId, '', amount FROM FinanceIncome
 WHERE ${MANUAL_INCOME_PREDICATE}
 AND COALESCE(orderId,0)=0
`;

type Identity = {id:number; phone?:string; phone_national_number?:string; status?:string; merged_to_member_id?:number; remark?:string};
type Receipt = {member_id:number; phone:string; amount:number};

export function aggregateMemberSpending(members: Identity[], receipts: Receipt[]) {
  const byId = new Map(members.map(m => [Number(m.id), m]));
  const canonical = (id:number) => {
    const seen = new Set<number>();
    while (byId.has(id) && !seen.has(id)) {
      seen.add(id);
      const m = byId.get(id)!;
      const next = Number(m.merged_to_member_id) || Number(m.remark?.match(/\[merged_into:(\d+)\]/)?.[1]);
      if (!next || !byId.has(next)) return id;
      id = next;
    }
    return 0; // A malformed merge cycle must not assign money arbitrarily.
  };
  const phones = new Map<string, Set<number>>();
  for (const m of members) {
    const id = canonical(Number(m.id));
    if (!id || byId.get(id)?.status === 'deleted') continue;
    for (const value of [m.phone, m.phone_national_number]) {
      const phone = normalizeMemberPhone(value);
      if (!phone) continue;
      if (!phones.has(phone)) phones.set(phone, new Set());
      phones.get(phone)!.add(id);
    }
  }
  const cents = new Map<number, number>();
  for (const r of receipts) {
    let id = byId.has(Number(r.member_id)) ? canonical(Number(r.member_id)) : 0;
    if (!id) {
      const matches = phones.get(normalizeMemberPhone(r.phone));
      if (matches?.size === 1) id = [...matches][0];
    }
    if (!id || byId.get(id)?.status === 'deleted' || !Number.isFinite(Number(r.amount))) continue;
    cents.set(id, (cents.get(id) || 0) + Math.round(Number(r.amount) * 100));
  }
  return new Map([...cents].map(([id, value]) => [id, value / 100]));
}

export function memberSpending(db: AdminDb) {
  return aggregateMemberSpending(
    db.prepare('SELECT id, phone, phone_national_number, status, merged_to_member_id, remark FROM Member').all<Identity>(),
    db.prepare(MEMBER_SPENDING_SQL).all<Receipt>(),
  );
}
