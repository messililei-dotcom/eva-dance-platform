/** Archive identity/receipts before the existing FK cascades remove event data. */
export function deleteEventRegistrations(db: any, ids: number[]) {
  const at = new Date().toISOString();
  for (const id of ids) {
    const row = db.prepare('SELECT p.*,g.name group_name,(SELECT title FROM event_performances WHERE player_id=p.id ORDER BY id DESC LIMIT 1) performance_title FROM event_players p LEFT JOIN event_groups g ON g.id=p.group_id WHERE p.id=?').get(id);
    if (!row) throw new Error('报名信息已变化，请刷新后再删除');
    db.prepare(`INSERT INTO event_deleted_registrations
      (id,competition_id,group_id,member_id,submitted_by_member_id,registration_batch_id,name,phone,group_name,performance_title,registration_fee,paid_amount,paid_status,paid_at,payment_method,status,audit_status,deleted_by,deleted_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      row.id,row.competition_id,row.group_id,row.member_id || 0,row.submitted_by_member_id || 0,row.registration_batch_id || 0,
      row.name,row.phone || '',row.group_name || '未分组',row.performance_title || '',row.registration_fee || 0,
      row.paid_amount || 0,row.paid_status || 'unpaid',row.paid_at || '',row.payment_method || '',
      row.status || '',row.audit_status || '',db.eventActorId || 0,at);
    db.prepare(`INSERT INTO event_deleted_registration_payments
      (original_payment_id,competition_id,player_id,kind,amount,method,paid_at,remark,created_by,created_at,request_key)
      SELECT id,competition_id,player_id,kind,amount,method,paid_at,remark,created_by,created_at,request_key
      FROM event_registration_payments WHERE player_id=?`).run(id);
    db.prepare('DELETE FROM event_registration_payments WHERE player_id=?').run(id);
    db.prepare('DELETE FROM event_players WHERE id=?').run(id);
  }
  return { deleted: ids.length };
}
