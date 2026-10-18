import type { AdminDb } from './admin-db';
import { ensureStaffInboxSchema } from './staff-inbox';

/** Clear the cancelled authorization ledger while retaining the original values in audit.
 * The order ledger (when linked) remains owned by the order/refund flow.
 * Call within the same transaction as revocation and its notification.
 */
export function clearRevokedAuthorizationFinancials(db: AdminDb, rows: any[], operatorId: number) {
  if (!rows.length) return;
  db.exec(`CREATE TABLE IF NOT EXISTS CourseAuthorizationRecordAudit (
    id INTEGER PRIMARY KEY AUTOINCREMENT, authorization_id INTEGER NOT NULL,
    action TEXT NOT NULL, actor_id INTEGER NOT NULL, before_json TEXT NOT NULL,
    after_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  const update = db.prepare(`UPDATE CourseAuthorization
    SET actual_amount=0, commission_amount=0, commission_rate=0
    WHERE id=? AND status='revoked'`);
  const get = db.prepare('SELECT * FROM CourseAuthorization WHERE id=?');
  const audit = db.prepare(`INSERT INTO CourseAuthorizationRecordAudit
    (authorization_id,action,actor_id,before_json,after_json) VALUES(?,?,?,?,?)`);
  const hasIncome = Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE name='FinanceIncome'").get());
  const income = hasIncome ? db.prepare(`UPDATE FinanceIncome SET amount=0
    WHERE incomeNo=? OR remark LIKE ? OR remark LIKE ?`) : null;
  for (const row of rows) {
    const before = get.get<any>(row.id);
    if (!before || before.status !== 'revoked') continue;
    update.run(row.id);
    income?.run(`AUTH-${row.id}`, `%AUTO_ONLINE_AUTH_INCOME|authorization_id=${row.id}`,
      `%AUTO_ONLINE_AUTH_INCOME|authorization_id=${row.id}\n%`);
    audit.run(row.id, 'revoke_financial_zero', operatorId, JSON.stringify(before), JSON.stringify(get.get(row.id)));
  }
}

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
  clearRevokedAuthorizationFinancials(db, rows, operatorId);
}
