import { createHash } from 'node:crypto';
import { importPhoneContact, normalizeImportRecord, importSourceRow } from '@/lib/event-import-format';
import type { ImportIdentityConflict, ImportIdentityDecision } from '@/lib/event-import-identity';
import { eventPhoneMemberCandidates, importEventEntries } from './event-entry-import';
import { normalizeEventMemberPhone } from './event-member-sync';
import { mergeConfirmedEventMembers } from '@/app/api/mini/_auth';

const nameKey = (value: unknown) => String(value ?? '').normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
const emptyResult = () => ({ created: 0, updated: 0, assigned: 0, skipped: 0, errors: [] as Array<{ row: number; message: string }>, conflicts: [] as ImportIdentityConflict[] });
type PersonImport = { contact: ReturnType<typeof importPhoneContact>; name: string; rows: Record<string, unknown>[]; sourceRows: number[]; candidates: any[]; decision?: ImportIdentityDecision };

export function importPlayersWithConfirmation(db: any, competitionId: number, rows: Record<string, unknown>[], decisions: ImportIdentityDecision[] = []) {
  // Lock the candidate snapshot through the final write, including across processes.
  return db.transaction(() => importConfirmedPlayers(db, competitionId, rows, decisions)).immediate();
}

function importConfirmedPlayers(db: any, competitionId: number, rows: Record<string, unknown>[], decisions: ImportIdentityDecision[]) {
  if (!db.prepare('SELECT id FROM event_competitions WHERE id=?').get(competitionId)) throw new Error('赛事不存在');
  const result = emptyResult();
  const groups = new Map<string, PersonImport>();
  rows.forEach((raw, index) => {
    const sourceRow = importSourceRow(raw, index + 2);
    let row: Record<string, unknown>;
    try {
      row = { ...normalizeImportRecord(raw, 'players'), __sourceRow: sourceRow };
    } catch (error) {
      result.errors.push({ row: sourceRow, message: error instanceof Error ? error.message : '导入数据格式错误' });
      return;
    }
    const contact = importPhoneContact(row['手机号'], row['区号']);
    const name = String(row['选手姓名'] ?? '').trim();
    const key = JSON.stringify([normalizeEventMemberPhone(contact.phone), nameKey(name)]);
    let group = groups.get(key);
    if (!group) {
      group = { contact, name, rows: [], sourceRows: [], candidates: [] };
      groups.set(key, group);
    } else if (contact.countryCode && !group.contact.countryCode) {
      group.contact = contact;
    }
    group.rows.push(row);
    group.sourceRows.push(sourceRow);
  });
  if (result.errors.length) return result;
  for (const group of groups.values()) {
    const { contact, name } = group;
    const phone = contact.phone;
    const candidates = group.candidates = eventPhoneMemberCandidates(db, phone, contact);
    if (!candidates.length || (candidates.length === 1 && nameKey(candidates[0].name) === nameKey(name))) continue;
    const key = createHash('sha256').update(JSON.stringify([competitionId, phone, nameKey(name), candidates.map(m => [m.id, m.name, m.phone, m.status, m.merged_to_member_id, m.wx_openid, m.wx_unionid])])).digest('hex');
    const visible = candidates.filter(m => !db.eventOwnerId || db.prepare('SELECT id FROM Member WHERE id=?').get(m.id));
    const conflict: ImportIdentityConflict = { key, phone, name, rows: group.sourceRows, candidates: visible.map(m => ({ id: Number(m.id), name: String(m.name || '未填写姓名') })), canMerge: !db.eventOwnerId && db.eventCanMergeMembers === true, unavailable: visible.length !== candidates.length };
    const decision = Array.isArray(decisions) ? decisions.find(d => d?.key === key) : undefined;
    const allowed = decision?.action === 'skip' || (!conflict.unavailable && candidates.some(m => Number(m.id) === decision?.targetId)
      && ((candidates.length === 1 && decision?.action === 'same') || (candidates.length > 1 && decision?.action === 'merge' && conflict.canMerge)));
    if (!allowed) result.conflicts.push(conflict);
    else group.decision = decision;
  }
  // Preflight performs no writes. Stale/forged decisions require fresh confirmation.
  if (result.conflicts.length) return result;
  const byPhone = new Map<string, PersonImport[]>();
  for (const group of groups.values()) {
    if (group.decision?.action === 'skip') { result.skipped += group.rows.length; continue; }
    const phoneKey = normalizeEventMemberPhone(group.contact.phone);
    const batch = byPhone.get(phoneKey) || [];
    batch.push(group); byPhone.set(phoneKey, batch);
  }
  for (const batch of byPhone.values()) {
    try {
      const outcome = db.transaction(() => {
        if (new Set(batch.map(g => nameKey(g.name))).size > 1) throw new Error('同一手机号填写了不同选手姓名，请分开核对后导入');
        const group = batch[0];
        if (group.decision?.action === 'merge') {
          mergeConfirmedEventMembers(db, group.decision.targetId!, group.candidates.map(m => Number(m.id)).filter(id => id !== group.decision!.targetId), group.name);
        }
        const rows = group.contact.countryCode ? group.rows.map(row => ({
          ...row, 区号: group.contact.countryCode, 手机号: group.contact.nationalNumber,
        })) : group.rows;
        const outcome = importEventEntries(db, competitionId, rows, 'players');
        if (outcome.errors.length) throw Object.assign(new Error('该选手导入失败，合并和报名修改均已撤回'), { importErrors: outcome.errors });
        return outcome;
      })();
      result.created += outcome.created; result.updated += outcome.updated;
    } catch (error: any) {
      if (String(error?.message).includes('无权限查看')) throw error;
      result.errors.push(...(error.importErrors || batch.flatMap(g => g.sourceRows.map(row => ({ row, message: /SQLITE|constraint/i.test(String(error.message)) ? '数据关联冲突，未合并也未导入，请联系平台管理员核对' : String(error.message || '导入失败') })))));
    }
  }
  return result;
}
