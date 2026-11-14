import { eventActor } from '../../../_access';
import { openEventDb, unauthorized, jsonError } from '../../../_db';
import { eventPlayerProfile, updateEventPlayerProfile, EventProfileError } from '@/lib/server/event-player-profile';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
async function profile(request: Request, params: Promise<{id:string}>, edit: boolean) {
  const actor=eventActor(request);
  if (!actor) return unauthorized();
  const {id}=await params;
  const body=edit ? await request.json().catch(()=>null) : null;
  if (edit && (!body || typeof body!=='object' || Array.isArray(body))) return jsonError('请填写有效的个人资料');
  // Authorization is rechecked in the write transaction; general event DB
  // connections keep their existing ban on shared Member mutations.
  const db=openEventDb();
  try {
    const data=edit ? updateEventPlayerProfile(db,actor,Number(id),body) : eventPlayerProfile(db,actor,Number(id));
    return Response.json({success:true,data},{headers:{'Cache-Control':'private, no-store'}});
  } catch (error) {
    if (error instanceof EventProfileError) return jsonError(error.message,error.status);
    if (error instanceof Error && error.message.includes('有待付款在线订单')) return jsonError(error.message,409);
    throw error;
  } finally {db.close();}
}
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}) {return profile(request,params,false);}
export async function PUT(request:Request,{params}:{params:Promise<{id:string}>}) {return profile(request,params,true);}
