import { cleanText, hasAuth, openTrainingDb, syncMemberDenormalizedFields, today, unauthorized } from '../../training-db';
import { upsertPhoneMember } from '../../mini/_auth';
import { deleteMemberAvatarFile } from '../_avatar-files';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const db = openTrainingDb();
  let replacedAvatarPath = '';
  try {
    const result = db.transaction(() => {
      const current = db.prepare('SELECT * FROM Member WHERE id = ?').get(routeParams.id);
      if (!current) return { changes: 0 };
      const name = cleanText(body.name, current.name);
      if (!name) throw new Error('请填写学员姓名');
      const phone = cleanText(body.phone ?? current.phone);
      const target = phone
        ? upsertPhoneMember(db, phone, { sourceMemberId: current.id, source: 'admin_member_edit' })
        : current;
      const targetId = target?.id || routeParams.id;

      const info = db.prepare(`
        UPDATE Member
        SET name = ?, phone = ?, gender = ?, birthday = ?, register_date = ?,
            country = ?, province = ?, city = ?, foreignRegion = ?, address = ?, remark = ?, avatar = ?,
            status = ?
        WHERE id = ?
      `).run(
        name,
        phone,
        cleanText(body.gender ?? current.gender, '女'),
        cleanText(body.birthday ?? current.birthday),
        cleanText(body.register_date ?? body.registerDate ?? current.register_date, today()),
        cleanText(body.country ?? current.country, '中国'),
        cleanText(body.province ?? current.province),
        cleanText(body.city ?? current.city),
        cleanText(body.foreignRegion ?? current.foreignRegion),
        cleanText(body.address ?? current.address),
        cleanText(body.remark ?? current.remark),
        cleanText(body.avatar ?? current.avatar),
        cleanText(body.status ?? current.status, 'active'),
        targetId,
      );
      if (cleanText(body.previousAvatar) && cleanText(body.previousAvatar) !== cleanText(body.avatar)) {
        replacedAvatarPath = cleanText(body.previousAvatar);
      }
      syncMemberDenormalizedFields(db, targetId);
      return info;
    })();
    if (!result.changes) return Response.json({ success: false, error: '学员不存在' }, { status: 404 });
    if (replacedAvatarPath) await deleteMemberAvatarFile(replacedAvatarPath);
    return Response.json({ success: true });
  } finally {
    db.close();
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();
  const db = openTrainingDb();
  try {
    const unfinished = db.prepare(`
      SELECT
        COUNT(*) AS count,
        COALESCE(SUM(COALESCE(remainingSessions, 0)), 0) AS remainingSessions
      FROM Payment
      WHERE memberId = ? AND COALESCE(remainingSessions, 0) > 0
    `).get(routeParams.id) as { count?: number; remainingSessions?: number } | undefined;
    if (Number(unfinished?.count || 0) > 0) {
      return Response.json({
        success: false,
        error: `该学员还有 ${Number(unfinished?.remainingSessions || 0)} 节课程未核销完毕，不能删除`,
      }, { status: 409 });
    }
    const result = db.prepare("UPDATE Member SET status = 'deleted' WHERE id = ?").run(routeParams.id);
    if (!result.changes) return Response.json({ success: false, error: '学员不存在' }, { status: 404 });
    return Response.json({ success: true });
  } finally {
    db.close();
  }
}
