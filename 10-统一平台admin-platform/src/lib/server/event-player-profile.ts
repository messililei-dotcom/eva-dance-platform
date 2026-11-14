import { normalizeEventPhone } from '@/lib/event-phone';
import { findPhoneMembers } from './event-phone-member';
import { syncMemberDenormalizedFields } from '@/app/api/training-db';

export class EventProfileError extends Error {
  constructor(message: string, public status=400) { super(message); }
}
const fields: Record<string,number> = {name:120,phone:30,gender:10,birthday:10,country:60,province:60,city:100,foreignRegion:100,address:300,remark:1000};

/** This explicit profile action grants access only through a managed event entry. */
export function eventPlayerProfile(db: any, actor: any, id: number): Record<string,any> {
  const player = db.prepare('SELECT id,member_id,competition_id FROM event_players WHERE id=?').get(id);
  if (!player) throw new EventProfileError('报名不存在',404);
  if (actor.role==='event_admin' && !db.prepare('SELECT c.id FROM event_competitions c WHERE c.id=? AND (c.owner_user_id=? OR EXISTS(SELECT 1 FROM event_competition_admins a WHERE a.competition_id=c.id AND a.user_id=?))').get(player.competition_id,actor.id,actor.id)) {
    throw new EventProfileError('无权限查看',403);
  }
  const member = db.prepare("SELECT * FROM Member WHERE id=? AND COALESCE(status,'active')!='deleted'").get(player.member_id);
  if (!member) throw new EventProfileError('该报名尚未关联有效用户，请先核对报名资料',409);
  // Do not return login identifiers, account status, rights or financial details.
  return {id:member.id,...Object.fromEntries(Object.keys(fields).map(key=>[key,String(member[key] || '')]))};
}

export function updateEventPlayerProfile(db: any, actor: any, id: number, body: Record<string,unknown>) {
  return db.transaction(() => {
    const current = eventPlayerProfile(db,actor,id);
    const values: Record<string,string> = {};
    const phoneFields: Record<string,string> = {};
    for (const [key,max] of Object.entries(fields)) {
      const value = body[key] ?? current[key];
      if (typeof value!=='string' || value.trim().length>max) throw new EventProfileError('个人资料格式或长度不正确');
      values[key]=value.trim();
    }
    if (!values.name) throw new EventProfileError('请填写姓名');
    if (values.phone!==current.phone) {
      try {
        const contact=normalizeEventPhone(values.phone); values.phone=contact.phone;
        phoneFields.phone_country_code=contact.countryCode; phoneFields.phone_national_number=contact.nationalNumber;
      }
      catch { throw new EventProfileError('请填写有效手机号（国际号码需含区号）'); }
      if (findPhoneMembers(db,values.phone).some((row:any)=>Number(row.id)!==Number(current.id)) || db.prepare('SELECT id FROM Member WHERE phone=? AND id<>?').get(values.phone,current.id)) {
        throw new EventProfileError('该手机号已属于其他用户，请核对；此处不会合并用户账号',409);
      }
    }
    if (values.birthday && (!/^\d{4}-\d{2}-\d{2}$/.test(values.birthday) || !Number.isFinite(Date.parse(values.birthday)))) throw new EventProfileError('生日格式应为 YYYY-MM-DD');
    const available=new Set(db.prepare('PRAGMA main.table_info(Member)').all().map((column:any)=>column.name));
    for(const [key,value] of Object.entries(phoneFields)) if(available.has(key)) values[key]=value;
    const columns=Object.keys(values);
    db.prepare('UPDATE Member SET '+columns.map(key=>'"'+key+'"=?').join(',')+' WHERE id=?').run(...columns.map(key=>values[key]),current.id);
    syncMemberDenormalizedFields(db,current.id);
    return eventPlayerProfile(db,actor,id);
  }).immediate();
}
