import { isPlatformOwner } from '@/lib/admin-feature-access';
import { eventActor } from '../../../_access';
import { hasAuth, unauthorized, jsonError, withRequestEventDb } from '../../../_db';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{id:string}> }) {
  if (!hasAuth(request)) return unauthorized();
  if (!isPlatformOwner(eventActor(request))) return jsonError('仅总管理员可查看收入明细',403);
  const {id} = await params;
  const url = new URL(request.url);
  const page = Math.max(1,Math.floor(Number(url.searchParams.get('page')) || 1));
  const pageSize = Math.min(100,Math.max(1,Math.floor(Number(url.searchParams.get('pageSize')) || 20)));
  return withRequestEventDb(request, db => {
    if (!db.prepare('SELECT id FROM event_competitions WHERE id=?').get(id)) return jsonError('赛事不存在',404);
    // Historical balances without individual receipts stay identifiable as balances.
    const source = `
      SELECT 'active:'||r.id recordKey,p.id playerId,p.name,g.name groupName,0 isDeleted,
        r.kind,ROUND(r.amount*100) amountFen,r.method,r.paid_at paidAt,r.remark,'' deletedAt
      FROM event_registration_payments r JOIN event_players p ON p.id=r.player_id
      LEFT JOIN event_groups g ON g.id=p.group_id WHERE r.competition_id=?
      UNION ALL
      SELECT 'deleted:'||r.id,p.id,p.name,p.group_name,1,
        r.kind,ROUND(r.amount*100),r.method,r.paid_at,r.remark,p.deleted_at
      FROM event_deleted_registration_payments r JOIN event_deleted_registrations p ON p.id=r.player_id
      WHERE r.competition_id=?
      UNION ALL
      SELECT 'balance:'||p.id,p.id,p.name,g.name,0,
        'balance',ROUND(p.paid_amount*100),p.payment_method,p.paid_at,'历史实收余额',''
      FROM event_players p LEFT JOIN event_groups g ON g.id=p.group_id
      WHERE p.competition_id=? AND p.paid_amount>0
        AND NOT EXISTS(SELECT 1 FROM event_registration_payments r WHERE r.player_id=p.id)
      UNION ALL
      SELECT 'deleted-balance:'||p.id,p.id,p.name,p.group_name,1,
        'balance',ROUND(p.paid_amount*100),p.payment_method,p.paid_at,'历史实收余额',p.deleted_at
      FROM event_deleted_registrations p WHERE p.competition_id=? AND p.paid_amount>0
        AND NOT EXISTS(SELECT 1 FROM event_deleted_registration_payments r WHERE r.player_id=p.id)
    `;
    const args = [id,id,id,id];
    const total = db.prepare('SELECT COUNT(*) total FROM ('+source+')').get(...args).total;
    const rows = db.prepare('SELECT * FROM ('+source+') ORDER BY paidAt DESC,recordKey DESC LIMIT ? OFFSET ?').all(...args,pageSize,(page-1)*pageSize);
    return Response.json({success:true,data:rows,total,page,pageSize},{headers:{'Cache-Control':'private, no-store'}});
  });
}
