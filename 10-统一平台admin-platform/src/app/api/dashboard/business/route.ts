import { hasAuth, unauthorized } from '../../training-db';
import { openAdminDb } from '@/lib/server/admin-db';
import { dashboard } from '@/lib/server/dashboard-engine';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 if(!hasAuth(request))return unauthorized();
 const p=new URL(request.url).searchParams;
 const db=openAdminDb({readonly:true});
 try{return Response.json({data:dashboard(db,p)},{headers:{'Cache-Control':'no-store'}});}
 catch(e){return Response.json({error:e instanceof Error?e.message:'统计加载失败'},{status:400});}
 finally{db.close();}
}
