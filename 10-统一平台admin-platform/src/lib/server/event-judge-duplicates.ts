import { sameJudgePhone } from '@/lib/event-import-format';
export function duplicateJudge(db: any, body: Record<string, any>, exceptId = 0) {
  const phone = String(body.phone ?? '').trim();
  const memberId = Number(body.memberId ?? body.member_id) || 0;
  const name = String(body.name || '').trim().toLocaleLowerCase();
  const organization = String(body.organization || '').trim().toLocaleLowerCase();
  const rows = db.prepare("SELECT id,member_id,name,phone,organization FROM main.event_judges WHERE id<>? AND COALESCE(status,'active')!='deleted'").all(exceptId);
  return rows.find((row: any) => sameJudgePhone(phone, row.phone)
    || (memberId > 0 && Number(row.member_id) === memberId)
    || (!phone && !row.phone && name === String(row.name || '').trim().toLocaleLowerCase() && organization === String(row.organization || '').trim().toLocaleLowerCase()));
}
