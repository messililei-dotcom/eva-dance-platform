import fs from 'node:fs';
import { MusicUploadError, persistEventMusic } from './event-music-upload';
import { normalizeEventPhone } from '@/lib/event-phone';
import { sameRegistrationPhone } from './event-registration-phone';

export function playerMusic(db: any, playerId: string, memberId?: number) {
  const player = db.prepare('SELECT * FROM event_players WHERE id=?').get(playerId);
  if (!player) throw new MusicUploadError('报名记录不存在或无权操作', 404);
  if (memberId) {
    const member = db.prepare('SELECT phone,phone_country_code FROM Member WHERE id=?').get(memberId);
    let phone = '';
    try { phone = normalizeEventPhone(member?.phone, member?.phone_country_code || '+86').phone; } catch { /* Only verified canonical phone matches can authorize a contact. */ }
    if (![Number(player.member_id), Number(player.submitted_by_member_id)].includes(memberId)
      && !(phone && sameRegistrationPhone(player.phone, phone))) {
      throw new MusicUploadError('无权修改该选手的音乐', 403);
    }
  }
  const performance = db.prepare('SELECT * FROM event_performances WHERE player_id=? ORDER BY id DESC LIMIT 1').get(playerId);
  const music = performance?.music_file_id ? db.prepare('SELECT * FROM event_music_files WHERE id=?').get(performance.music_file_id) : null;
  return { player, performance, music };
}

export function replacePlayerMusic(db: any, playerId: string, title: string, name: string, bytes: Buffer, duration: number, memberId?: number) {
  let stored: ReturnType<typeof persistEventMusic> | undefined;
  try {
    return db.transaction(() => {
      const { player, performance } = playerMusic(db, playerId, memberId);
      if (['cancelled', 'withdrawn'].includes(player.status)) throw new MusicUploadError('该报名已取消，无法更换音乐', 409);
      const performanceTitle = String(title || performance?.title || '').trim();
      if (!performanceTitle || performanceTitle.length > 120) throw new MusicUploadError('请填写1至120字的节目（音乐）名字');
      stored = persistEventMusic(name, bytes);
      const now = new Date().toISOString();
      const music = db.prepare(`INSERT INTO event_music_files (competition_id,group_id,player_id,file_name,file_url,file_size,duration_seconds,audit_status,uploaded_at,updated_at) VALUES (?,?,?,?,?,?,?,'pending',?,?)`)
        .run(player.competition_id, player.group_id, player.id, stored.name, stored.fileURL, bytes.length, duration, now, now);
      if (performance) {
        db.prepare('UPDATE event_performances SET title=?, music_file_id=?, duration_seconds=?, updated_at=? WHERE id=?')
          .run(performanceTitle, music.lastInsertRowid, duration, now, performance.id);
      } else {
        db.prepare(`INSERT INTO event_performances (competition_id,group_id,player_id,title,music_file_id,duration_seconds,status,updated_at) VALUES (?,?,?,?,?,?,'pending',?)`)
          .run(player.competition_id, player.group_id, player.id, performanceTitle, music.lastInsertRowid, duration, now);
      }
      return { musicFileId: Number(music.lastInsertRowid), fileName: stored.name, performanceTitle };
    }).immediate();
  } catch (error) {
    if (stored) fs.unlinkSync(stored.file);
    throw error;
  }
}
