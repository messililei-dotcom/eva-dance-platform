import type { AdminDb } from './admin-db';
import { ensureStaffInboxSchema } from './staff-inbox';

/** Only newly revoked rows are notified, within the revocation transaction. */
export function notifyAuthorizationRevocation(db: AdminDb, rows: any[], operatorId: number) {
  if (!rows.length) return;
  ensureStaffInboxSchema(db);
  const operator = db.prepare('SELECT name,username FROM User WHERE id=?').get<any>(operatorId);
  const recipients = db.prepare("SELECT id FROM User WHERE status='active' AND role IN ('super_admin','admin','teacher','operator') AND id<>?").all<any>(operatorId);
  for (const row of rows) {
    const member = db.prepare('SELECT name,phone FROM Member WHERE id=?').get<any>(row.member_id);
    const course = db.prepare('SELECT name FROM CourseSeries WHERE id=?').get<any>(row.series_id);
    const commission = Number(row.commission_amount || 0);
    const content = `${operator?.name || operator?.username || `管理员${operatorId}`}在${row.revoked_at}取消了${member?.name || member?.phone || row.phone || '学员'}的「${course?.name || `课程${row.series_id}`}」课程授权。请退回提成奖金 ¥${commission.toFixed(2)}（课程顾问：${row.sales || '未记录'}）。账面提成已扣回，已发放奖金请办理退回。`;
    const message = db.prepare(`INSERT INTO StaffInboxMessage(type,title,content,business_type,business_id,priority,created_at)
      VALUES ('authorization_revoked','取消授权：请退回提成奖金',?,'authorization_revoked',?,'important',?)`).run(content, String(row.id), row.revoked_at);
    const insert = db.prepare('INSERT INTO StaffInboxRecipient(message_id,user_id) VALUES (?,?)');
    for (const recipient of recipients) insert.run(message.lastInsertRowid, recipient.id);
  }
}
