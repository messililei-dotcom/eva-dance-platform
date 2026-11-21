import { hasAuth, unauthorized, withRequestEventDb, readEventBody, jsonError } from '../../../_db';
import { recordRegistrationPayment, registrationPaymentState } from '@/lib/server/event-registration-fees';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const privateResponse = { headers: { 'Cache-Control': 'private, no-store' } };
export async function GET(request: Request, { params }: { params: Promise<{id: string}> }) {
  if (!hasAuth(request)) return unauthorized();
  const {id} = await params;
  return withRequestEventDb(request, db => db.transaction(() => {
    const player = db.prepare('SELECT * FROM event_players WHERE id=?').get(id);
    if (!player) return jsonError('报名不存在',404);
    const records = db.prepare('SELECT * FROM event_registration_payments WHERE player_id=? ORDER BY paid_at DESC,id DESC').all(id);
    return Response.json({ success: true, data: records, paymentState: registrationPaymentState(db, player) }, privateResponse);
  })());
}
export async function POST(request: Request, { params }: { params: Promise<{id: string}> }) {
  if (!hasAuth(request)) return unauthorized();
  const {id} = await params, body = await readEventBody(request);
  return withRequestEventDb(request, db => {
    try { return Response.json({success:true,data:db.transaction(() => recordRegistrationPayment(db,Number(id),body)).immediate()}, privateResponse); }
    catch (error: any) { if (String(error.message).includes('无权限查看')) throw error; return jsonError(error.message || '登记失败'); }
  });
}
