import { normalizeEventPhone } from '@/lib/event-phone';
import { samePhoneIdentity } from './event-phone-member';
import { playerMusic } from './event-player-music';
import { MusicUploadError } from './event-music-upload';

export function registrationDetails(db: any, id: string, memberId: number) {
  const { player, performance } = playerMusic(db, id, memberId);
  let countryCode = '+86';
  try { countryCode = normalizeEventPhone(player.phone).countryCode; } catch { /* Historical contact values remain editable. */ }
  return {
    name: player.name || '', phone: player.phone || '', countryCode,
    organization: player.organization || '', teacher: player.teacher || '', remark: player.remark || '',
    performanceTitle: performance?.title || '', canEdit: !['cancelled', 'withdrawn'].includes(player.status),
  };
}

export function updateRegistrationDetails(db: any, id: string, memberId: number, body: Record<string, unknown>) {
  return db.transaction(() => {
    const current = registrationDetails(db, id, memberId);
    if (!current.canEdit) throw new MusicUploadError('该报名已取消，无法修改', 409);
    const limits: Record<string, number> = { name: 120, phone: 20, organization: 100, teacher: 60, remark: 500, performanceTitle: 120 };
    const fields: Record<string, string> = {};
    for (const [key, limit] of Object.entries(limits)) {
      const value = body[key] ?? current[key as keyof typeof current];
      if (typeof value !== 'string' || value.trim().length > limit) throw new MusicUploadError('报名信息格式或长度不正确');
      fields[key] = value.trim();
    }
    if (!fields.name || !fields.performanceTitle) throw new MusicUploadError('请填写姓名和节目（音乐）名字');
    try { fields.phone = normalizeEventPhone(fields.phone, body.countryCode || current.countryCode).phone; }
    catch (error) {
      if (fields.phone !== current.phone) throw new MusicUploadError(error instanceof Error ? error.message : '手机号格式错误');
    }
    const { player, performance } = playerMusic(db, id, memberId);
    const duplicate = db.prepare("SELECT phone FROM event_players WHERE competition_id=? AND group_id=? AND id<>? AND status NOT IN ('cancelled','withdrawn') AND audit_status<>'rejected'")
      .all(player.competition_id, player.group_id, player.id).some((row: any) => samePhoneIdentity(row.phone, fields.phone));
    if (duplicate) throw new MusicUploadError('该手机号已报名本组别，请核对报名信息', 409);
    const now = new Date().toISOString();
    db.prepare('UPDATE event_players SET name=?,phone=?,organization=?,teacher=?,remark=?,updated_at=? WHERE id=?')
      .run(fields.name, fields.phone, fields.organization, fields.teacher, fields.remark, now, player.id);
    if (performance) db.prepare('UPDATE event_performances SET title=?,updated_at=? WHERE id=?').run(fields.performanceTitle, now, performance.id);
    else db.prepare("INSERT INTO event_performances(competition_id,group_id,player_id,title,status,updated_at) VALUES(?,?,?,?,'pending',?)")
      .run(player.competition_id, player.group_id, player.id, fields.performanceTitle, now);
    return registrationDetails(db, id, memberId);
  }).immediate();
}
