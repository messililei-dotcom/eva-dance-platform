import { createHash, createCipheriv, randomBytes, randomUUID } from 'node:crypto';
import type { AdminDb } from './admin-db';
import { AppError } from './app-session';

const q = (s:string) => '"' + s.replace(/"/g,'""') + '"';
const owned: Record<string,string[]> = {
  MiniSmsCode:[], ConsultationRequest:[],
  AppLearningCheckpoint:['member_id'], AppPasswordCredential:['member_id'], AppSession:['member_id'],
  MemberDeviceSession:['member_id'], WechatIdentity:['member_id'], WechatLoginHandoff:['member_id'],
  WechatIdentityAudit:['member_id','related_member_id'], StudyNote:['member_id'], VideoBookmark:['member_id'],
  VideoProgress:['member_id'], VideoProgressRepairAudit:['member_id'], VideoProgressUnresolvedArchive:['member_id'],
  PracticeCheckin:['member_id'], CourseSeriesVisit:['member_id'], CourseSeriesVisitLog:['member_id','referrer_member_id'],
  MemberBadge:['member_id'], InboxRecipient:['member_id'], StudentGrowthSummary:['user_id'],
  ExperienceLedger:['user_id'], LevelChangeLog:['user_id'], AcademyStartAudit:['user_id'],
  shop_member_shipping:['member_id'], Answer:['member_id'], Question:['member_id'],
};
// These records can carry legal/accounting duties, third-party data or public files.
// A case cannot be completed by merely accepting a warning: the affected records
// must first be fulfilled by the operator and rechecked by the same planner.
const review: Record<string,string[]> = {
  Certificate:['member_id'], CourseAuthorization:['member_id'], CourseOrder:['member_id'], CommissionRecord:['member_id'],
  Payment:['memberId'], ConsumeRecord:['memberId'], FinanceIncome:['memberId'], FinanceOrder:['memberId'],
  HistoricalOfflineImportAudit:['member_id'], OfflineAttendance:['member_id'], OfflineBooking:['member_id'],
  OfflineEnrollment:['member_id'], OfflineEntitlement:['member_id'], DistributionRelation:['member_id','parent_id','grandparent_id'],
  event_players:['member_id','submitted_by_member_id'], event_judges:['member_id'], exclusive_claims:['member_id'],
  orders:['member_id'], shop_online_orders:['member_id'], shop_sales:['member_id'],
};
const separateNamespace = new Set(['User','AdminUser','admin_user_roles','StaffInboxRecipient','event_competition_admins']);
const phones = ['phone','memberPhone','member_phone','customer_phone','source_phone'];
const wx = ['wx_openid','wx_unionid','openid','unionid'];
function schema(db:AdminDb) {
  return db.prepare("SELECT name,sql FROM sqlite_master WHERE type='table' ORDER BY name").all<{name:string;sql:string}>()
    .filter(t=>!t.name.startsWith('sqlite_')).map(t=>({...t,columns:db.prepare(`PRAGMA table_info(${q(t.name)})`).all<{name:string}>().map(c=>c.name)}));
}
export function planAccountDeletion(db:AdminDb, requestId:string) {
  const request = db.prepare('SELECT * FROM AppDeletionRequest WHERE id=?').get<any>(requestId);
  if (!request || request.status !== 'pending') throw new AppError('待处理注销申请不存在',404);
  const member = db.prepare('SELECT * FROM Member WHERE id=?').get<any>(request.member_id);
  if (!member) throw new AppError('注销账号资料缺失，需人工核查',409);
  const rows = db.prepare('SELECT * FROM Member').all<any>();
  const ids = new Set<number>([Number(member.id)]);
  let changed = true;
  const target = (m:any) => Number(m.merged_to_member_id || String(m.remark || '').match(/member_id\s*=\s*(\d+)/i)?.[1] || 0);
  while (changed) { changed=false; for (const m of rows) if (ids.has(Number(m.id)) || ids.has(target(m))) {
    for (const id of [Number(m.id),target(m)]) if(id>0 && !ids.has(id)){ids.add(id);changed=true;}
  }}
  const members=rows.filter(m=>ids.has(Number(m.id)));
  const identities={phone:new Set<string>(),wechat:new Set<string>()};
  for(const m of members){for(const k of ['phone','phone_national_number'])if(m[k])identities.phone.add(String(m[k]));for(const k of wx)if(m[k])identities.wechat.add(String(m[k]));}
  const blockers:string[]=[];
  if(members.length!==ids.size)blockers.push('合并账号链包含缺失账号，需核实归属');
  for(const m of rows.filter(m=>!ids.has(Number(m.id)))) if ((m.phone && identities.phone.has(String(m.phone))) || wx.some(k=>m[k] && identities.wechat.has(String(m[k])))) blockers.push('存在未合并的重复身份，需核实归属');
  if (members.some(m=>[m.avatar,m.wx_avatar_url].some(v=>String(v||'').startsWith('/uploads/')))) blockers.push('需先清理账号专用头像文件并核对共享引用');
  const operations:Array<{table:string;where:string;values:unknown[];count:number;rowsHash:string;action:'delete'|'review'}>=[];
  const definitions=schema(db);
  for(const t of definitions){
    if(separateNamespace.has(t.name) || ['Member','AppDeletionRequest','AppDeletionReceipt','AppDeletionRetention'].includes(t.name)) continue;
    const keys=owned[t.name] || review[t.name] || t.columns.filter(c=>['member_id','memberId','related_member_id','submitted_by_member_id','referrer_member_id','user_id','student_id','studentId'].includes(c));
    const terms:string[]=[],values:unknown[]=[];
    for(const k of keys.filter(k=>t.columns.includes(k))) {terms.push(`${q(k)} IN (${[...ids].map(()=>'?').join(',')})`);values.push(...ids);}
    for(const k of [...phones,...wx].filter(k=>t.columns.includes(k))) {
      const set=phones.includes(k)?identities.phone:identities.wechat;
      if(set.size){const owner=t.columns.includes('member_id')?'member_id':t.columns.includes('memberId')?'memberId':'';
        terms.push(`(${owner ? `COALESCE(${q(owner)},0)=0 AND ` : ''}${q(k)} IN (${[...set].map(()=>'?').join(',')}))`);values.push(...set);}
    }
    if(!terms.length)continue;
    const where=terms.join(' OR ');
    const count=Number(db.prepare(`SELECT COUNT(*) n FROM ${q(t.name)} WHERE ${where}`).get<any>(...values)?.n||0);
    if(!count)continue;
    const records=db.prepare(`SELECT * FROM ${q(t.name)} WHERE ${where}`).all<any>(...values);
    const freeGrant=t.name==='CourseAuthorization' && records.every(r=>!r.order_id && !Number(r.actual_amount) && (!r.order_vouchers || r.order_vouchers==='[]') && !Number(r.commission_amount) && ['admin_grant','phone_grant'].includes(r.type));
    const action=owned[t.name] || freeGrant ? 'delete':'review';
    const rowsHash=createHash('sha256').update(JSON.stringify(records.map(r=>JSON.stringify(r)).sort())).digest('hex');
    operations.push({table:t.name,where,values,count,rowsHash,action});
    if(action==='review')blockers.push(`${t.name}: ${count}条记录需先处理留存、解绑、公开资料或文件`);
  }
  // Personal content belonging to another person may contain a response to a
  // deleting user's question; remove only responses within the owned thread.
  if(definitions.some(t=>t.name==='Answer') && definitions.some(t=>t.name==='Question')) {
    const values=[...ids];const where=`question_id IN (SELECT id FROM Question WHERE member_id IN (${values.map(()=>'?').join(',')}))`;
    const count=Number(db.prepare(`SELECT COUNT(*) n FROM Answer WHERE ${where}`).get<any>(...values)?.n||0);
    if(count)operations.unshift({table:'Answer',where,values,count,rowsHash:createHash('sha256').update(JSON.stringify(db.prepare(`SELECT * FROM Answer WHERE ${where}`).all(...values))).digest('hex'),action:'delete'});
  }
  for(const t of definitions) {
    if(separateNamespace.has(t.name) || ['Member','AppDeletionRequest','AppDeletionReceipt','AppDeletionRetention'].includes(t.name))continue;
    const textCols=t.columns.filter(c=>/json|detail|content|message|snapshot|remark|payload/i.test(c));
    const needles=[...identities.phone,...identities.wechat].filter(v=>v.length>=7);
    if(!textCols.length || !needles.length)continue;
    const terms:string[]=[],values:string[]=[];
    for(const c of textCols)for(const needle of needles){terms.push(`instr(COALESCE(${q(c)},''),?)>0`);values.push(needle);}
    const n=Number(db.prepare(`SELECT COUNT(*) n FROM ${q(t.name)} WHERE ${terms.join(' OR ')}`).get<any>(...values)?.n||0);
    if(n && !owned[t.name])blockers.push(`${t.name}: ${n}条文本或快照含账号身份，需清理后复核`);
  }
  if(definitions.some(t=>t.name==='AppSpentRefresh')) {
    const values=[...ids],where=`session_id IN (SELECT id FROM AppSession WHERE member_id IN (${values.map(()=>'?').join(',')}))`;
    const rows=db.prepare(`SELECT * FROM AppSpentRefresh WHERE ${where}`).all(...values);
    if(rows.length)operations.unshift({table:'AppSpentRefresh',where,values,count:rows.length,rowsHash:createHash('sha256').update(JSON.stringify(rows)).digest('hex'),action:'delete'});
  }
  const schemaHash=createHash('sha256').update(JSON.stringify(definitions)).digest('hex');
  const result={requestId,memberIds:[...ids].sort((a,b)=>a-b),requestedAt:request.requested_at,
    dueAt:request.requested_at+7*86400_000,operations,blockers:[...new Set(blockers)],schemaHash};
  return {...result,planHash:createHash('sha256').update(JSON.stringify(result)).digest('hex')};
}
export function completeAccountDeletion(db:AdminDb, requestId:string, expectedHash:string, now=Date.now()) {
  return db.transaction(()=>{
    const plan=planAccountDeletion(db,requestId);
    if(plan.planHash!==expectedHash || plan.blockers.length)throw new AppError('注销处理范围已变化或仍有未处理事项，禁止完成',409);
    for(const op of plan.operations)db.prepare(`DELETE FROM ${q(op.table)} WHERE ${op.where}`).run(...op.values);
    const list=plan.memberIds.map(()=>'?').join(',');
    db.prepare(`DELETE FROM Member WHERE id IN (${list})`).run(...plan.memberIds);
    db.prepare("UPDATE AppDeletionRequest SET member_id=0,status='completed',completed_at=?,note='' WHERE id=?").run(now,requestId);
    db.prepare("UPDATE AppDeletionReceipt SET notice=? WHERE request_id=?").run('账号注销已完成。账号与非必需关联个人资料已删除。依法留存的具体范围、依据和期限（如有）见下方明细，不再用于普通账号服务。',requestId);
    return {id:requestId,status:'completed',completedAt:now,noticeStored:true};
  })();
}

export type DeletionCaseDecision = { table:string; action:'delete'|'retain'; basis:string; scope:string; fields?:string[]; expiresAt?:number };
// The finance operator supplies a reviewed per-case manifest. There is no
// blanket retention period and no API exposing the encrypted archive.
export function fulfillReviewedDeletionRecords(db:AdminDb, requestId:string, expectedHash:string,
  confirmedBy:string, decisions:DeletionCaseDecision[], keyHex:string, now=Date.now()) {
  if(!confirmedBy.trim() || confirmedBy.length>100 || !Array.isArray(decisions) || !decisions.length)throw new AppError('需要逐项确认的处理清单');
  const financial=new Set(['CourseAuthorization','CourseOrder','CommissionRecord','Payment','ConsumeRecord','FinanceIncome','FinanceOrder','HistoricalOfflineImportAudit','OfflineAttendance','OfflineBooking','OfflineEnrollment','OfflineEntitlement','orders','shop_online_orders','shop_sales','exclusive_claims']);
  return db.transaction(()=>{
    const plan=planAccountDeletion(db,requestId);
    if(plan.planHash!==expectedHash)throw new AppError('处理范围已变化，请重新核对',409);
    const seen=new Set<string>();
    for(const decision of decisions){
      const op=plan.operations.find(o=>o.table===decision.table && o.action==='review');
      if(!op || seen.has(op.table) || !decision.basis?.trim() || !decision.scope?.trim())throw new AppError('清单需对应当前待处理记录并说明依据',409);
      seen.add(op.table);
      const rows=db.prepare(`SELECT * FROM ${q(op.table)} WHERE ${op.where}`).all<any>(...op.values);
      if(rows.some(r=>['voucherPath','voucherFilename','order_vouchers','pdf_url','certificate_url'].some(k=>r[k] && r[k]!=='[]')))throw new AppError('须先核对并隔离凭证/公开文件，不可仅清除引用',409);
      if(decision.action==='delete'){
        db.prepare(`DELETE FROM ${q(op.table)} WHERE ${op.where}`).run(...op.values);
        continue;
      }
      if(decision.action!=='retain' || !financial.has(op.table) || !/^[a-f0-9]{64}$/i.test(keyHex) || !Number.isSafeInteger(decision.expiresAt) || Number(decision.expiresAt)<=now)throw new AppError('法定留存须有必要字段、期限及私密密钥');
      const fields=decision.fields;
      if(!fields?.length || fields.some(f=>!Object.hasOwn(rows[0],f) || /password|token|digest|salt|session_key/i.test(f)))throw new AppError('留存字段不正确或包含登录机密');
      const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',Buffer.from(keyHex,'hex'),iv);
      cipher.setAAD(Buffer.from(requestId+':'+op.table));
      const payload=JSON.stringify(rows.map(r=>Object.fromEntries(fields.map(f=>[f,r[f]]))));
      const encrypted=Buffer.concat([cipher.update(payload,'utf8'),cipher.final()]);
      db.prepare('INSERT INTO AppDeletionRetention(id,request_id,scope,basis,confirmed_by,expires_at,encrypted_data,created_at)VALUES(?,?,?,?,?,?,?,?)').run(randomUUID(),requestId,decision.scope,decision.basis,confirmedBy,decision.expiresAt,[iv.toString('base64'),cipher.getAuthTag().toString('base64'),encrypted.toString('base64')].join('.'),now);
      const columns=Object.keys(rows[0]),sets:string[]=[],values:unknown[]=[];
      for(const k of columns){
        if(['member_id','memberId','related_member_id','submitted_by_member_id','parent_id','grandparent_id'].includes(k)){
          // Distinct unlinked placeholders preserve unique accounting relations.
          sets.push(`${q(k)}=CASE ${plan.memberIds.map(()=>`WHEN ${q(k)}=? THEN ?`).join(' ')} ELSE ${q(k)} END`);
          for(const id of plan.memberIds)values.push(id,-parseInt(createHash('sha256').update(requestId+':'+id).digest('hex').slice(0,12),16));
        } else if(/^(name|memberName|member_name|memberPhone|member_phone|customer_phone|source_name|source_phone|phone|recipient|recipient_name|payer|address|address_hash|gender|birthday|remark|refund_reason|wx_openid|wx_unionid|wx_name|wx_account|organization|teacher|id_card)$/.test(k)){sets.push(`${q(k)}=?`);values.push('');}
      }
      if(op.table==='CourseAuthorization')sets.push("status='revoked'");
      if(!sets.length)throw new AppError('该类记录需要专项处理器，不能直接完成',409);
      db.prepare(`UPDATE ${q(op.table)} SET ${sets.join(',')} WHERE ${op.where}`).run(...values,...op.values);
    }
    return {requestId,processedTables:[...seen],completed:false};
  })();
}
