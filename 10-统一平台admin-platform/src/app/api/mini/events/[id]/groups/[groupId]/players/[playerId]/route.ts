import {openAdminDb} from '@/lib/server/admin-db';
import {loadPublicPlayerDetail} from '@/lib/public-event-data';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function GET(_request:Request,context:{params:Promise<{id:string;groupId:string;playerId:string}>}) {
 const {id,groupId,playerId}=await context.params;
 const keys=[id,groupId,playerId].map(Number);
 if(keys.some(n=>!Number.isSafeInteger(n)||n<=0))return Response.json({success:false,error:'选手不存在'},{status:404});
 const db=openAdminDb({readonly:true});
 try {
  const competition=db.prepare("SELECT id,name,registration_public,judge_scores_public FROM event_competitions WHERE id=? AND status IN ('published','finished')").get<{id:number;name:string;registration_public:number;judge_scores_public:number}>(keys[0]);
  const group=db.prepare("SELECT id,name FROM event_groups WHERE id=? AND competition_id=? AND status='active'").get<{id:number;name:string}>(keys[1],keys[0]);
  if(!competition||!group)return Response.json({success:false,error:'选手不存在'},{status:404});
  const detail=loadPublicPlayerDetail(keys[0],keys[1],keys[2]);
  if(!detail)return Response.json({success:false,error:'选手不存在或报名信息未公开'},{status:404});
  const p=detail.player;
  return Response.json({success:true,data:{competition:{id:competition.id,name:competition.name,registrationPublic:competition.registration_public===1,judgeScoresPublic:competition.judge_scores_public===1},group,player:{id:p.id,name:p.name,playerNo:p.player_no,avatarUrl:p.avatar_url,organization:p.organization,teacher:p.teacher,performanceTitle:p.performance_title,rankNo:p.rank_no,publishedTotal:p.published_total},judgeScores:detail.scores.map(s=>({id:s.id,name:s.judge_name,title:s.judge_title,avatarUrl:s.avatar_url,score:s.score}))}},{headers:{'Cache-Control':'private, no-store'}});
 }catch{return Response.json({success:false,error:'选手详情加载失败'},{status:503});}finally{db.close();}
}
