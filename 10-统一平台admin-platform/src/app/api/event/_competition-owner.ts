import { isPlatformSuperAdmin } from '@/lib/admin-feature-access';
import { eventActor } from './_access';

// Omitted ownership preserves existing access; explicit changes are super-admin only.
export function competitionOwner(request: Request, db: any, body: any, fallback: number) {
  if (body.ownerUserId === undefined && body.adminUserIds === undefined) return { id: fallback };
  if (!isPlatformSuperAdmin(eventActor(request))) return { error: '只有超级管理员可以分配赛事管理员', status: 403 };
  if (body.adminUserIds !== undefined) {
    if (!Array.isArray(body.adminUserIds) || body.adminUserIds.length > 100 || body.adminUserIds.some((id: unknown) => typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0)) {
      return { error: '请选择有效的赛事管理员', status: 400 };
    }
    const adminIds = [...new Set<number>(body.adminUserIds)];
    for (const id of adminIds) {
      const user = db.prepare('SELECT id, role, status, username FROM User WHERE id=?').get(id);
      if (!user || user.status !== 'active' || (user.role !== 'event_admin' && !isPlatformSuperAdmin(user))) return { error: '请选择启用的赛事管理员账号', status: 400 };
    }
    return { id: adminIds[0] || 0, adminIds };
  }
  const id = Number(body.ownerUserId);
  if (!Number.isSafeInteger(id) || id <= 0) return { error: '请选择有效的赛事管理员', status: 400 };
  const user = db.prepare('SELECT id, role, status, username FROM User WHERE id=?').get(id);
  if (!user || user.status !== 'active' || (user.role !== 'event_admin' && !isPlatformSuperAdmin(user))) {
    return { error: '请选择启用的赛事管理员账号', status: 400 };
  }
  return { id };
}

export function saveCompetitionAdmins(db: any, competitionId: number | string | bigint, body: any, owner: { id?: number; adminIds?: number[] }) {
  if (body.adminUserIds === undefined && body.ownerUserId === undefined) return;
  db.prepare('DELETE FROM event_competition_admins WHERE competition_id=?').run(competitionId);
  const insert = db.prepare('INSERT INTO event_competition_admins (competition_id,user_id) VALUES (?,?)');
  for (const id of owner.adminIds ?? (owner.id ? [owner.id] : [])) insert.run(competitionId, id);
}
