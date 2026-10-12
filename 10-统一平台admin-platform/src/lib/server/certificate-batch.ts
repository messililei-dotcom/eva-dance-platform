import type { AdminDb } from '@/lib/server/admin-db';
import { certificateNo, certificatePublicUrl, certificateVerifyUrl, ensureTemplateForSeries } from './certificates';
import { createPersonalMessage } from './inbox';

export function certificateRoster(db: AdminDb, seriesId: number) {
  const course = seriesId < 0
    ? db.prepare('SELECT id, name, subType FROM Course WHERE id = ?').get(Math.abs(seriesId))
    : db.prepare('SELECT id, name FROM CourseSeries WHERE id = ?').get(seriesId);
  if (!course) throw new Error('课程或期次不存在');
  const students = seriesId < 0
    ? db.prepare(`SELECT DISTINCT m.id AS memberId, m.name AS memberName, m.phone AS memberPhone
        FROM Payment p JOIN Member m ON m.id = p.memberId
        WHERE p.courseId = ? AND COALESCE(p.paymentStatus, 'paid') NOT IN ('refunded', 'cancelled', 'unpaid', 'pending')`).all(Math.abs(seriesId))
    : db.prepare(`SELECT DISTINCT m.id AS memberId, m.name AS memberName, m.phone AS memberPhone
        FROM CourseAuthorization a JOIN Member m ON m.id = a.member_id
        OR (COALESCE(a.member_id, 0) <= 0 AND NULLIF(a.phone, '') = m.phone)
        WHERE a.series_id = ? AND a.status = 'active'
        AND (a.expire_at IS NULL OR a.expire_at = '' OR a.expire_at > datetime('now','localtime'))`).all(seriesId);
  const issued = new Map(db.prepare("SELECT member_id, certificate_no FROM Certificate WHERE series_id = ? AND status = 'active'").all(seriesId).map(c => [Number(c.member_id), c.certificate_no]));
  return { course, students: students.map(s => ({ ...s, issued: issued.has(Number(s.memberId)), certificateNo: issued.get(Number(s.memberId)) || '' })).sort((a,b) => String(a.memberName).localeCompare(String(b.memberName), 'zh-CN')) };
}

export async function issueCertificateBatch(db: AdminDb, seriesId: number, memberIds: number[]) {
  const initial = certificateRoster(db, seriesId);
  const allowed = new Set(initial.students.map(s => Number(s.memberId)));
  if (memberIds.some(id => !allowed.has(id))) throw new Error('所选学员不在当前课程或期次中，请刷新名单');
  const template = await ensureTemplateForSeries(db, seriesId, initial.course.name);
  return db.transaction(() => {
    // Re-read membership and certificates after acquiring the write lock.
    db.prepare('UPDATE CertificateTemplate SET id = id WHERE id = ?').run(template.id);
    const roster = certificateRoster(db, seriesId);
    const byId = new Map(roster.students.map(s => [Number(s.memberId), s]));
    if (memberIds.some(id => !byId.has(id))) throw new Error('学员名单已变更，请刷新后重试');
    let issued = 0, skipped = 0;
    for (const memberId of memberIds) {
      if (byId.get(memberId)!.issued) { skipped++; continue; }
      const no = certificateNo(memberId, seriesId);
      const result = db.prepare(`INSERT INTO Certificate (certificate_no, series_id, member_id, issue_date, pdf_url, status, source_platform, issue_method, verify_code, verify_url, completion_rate, template_id, remark, updated_at)
        VALUES (?, ?, ?, datetime('now','localtime'), '', 'active', ?, ?, ?, ?, 100, ?, ?, datetime('now','localtime'))`).run(no, seriesId, memberId, seriesId < 0 ? 'training' : 'admin', seriesId < 0 ? 'training_batch' : 'manual_batch', no, certificateVerifyUrl(no), template.id || 0, `批量颁发：${roster.course.name}${roster.course.subType ? ' / ' + roster.course.subType : ''}`);
      db.prepare('UPDATE Certificate SET pdf_url = ? WHERE id = ?').run(certificatePublicUrl(result.lastInsertRowid, no), result.lastInsertRowid);
      createPersonalMessage(db, memberId, { type: 'certificate', title: '结业证书已生成', content: `你的《${roster.course.name}》${roster.course.subType ? roster.course.subType + '期次' : ''}结业证书已经生成。`, actionUrl: '/dashboard/profile#certificates', businessType: 'certificate', businessId: result.lastInsertRowid, dedupeKey: `certificate:${result.lastInsertRowid}`, priority: 'important' });
      issued++;
    }
    return { issued, skipped, requested: memberIds.length };
  })();
}
