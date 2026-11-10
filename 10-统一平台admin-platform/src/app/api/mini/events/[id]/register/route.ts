import { samePhoneIdentity } from '@/lib/server/event-phone-member';
import { normalizeEventPhone } from '@/lib/event-phone';
import {ensureEventOnline,ensurePhoneMember} from '@/lib/server/event-online';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { eventRegistrationForm, normalizedMusicForm, validatePlayableMusic, persistEventMusic, MusicUploadError } from '@/lib/server/event-music-upload';
import { getMemberId } from '../../../_helpers';
import { cleanText, nowIso, toNumber, withEventDb } from '../../../../event/_db';
import { createPersonalMessage } from '@/lib/server/inbox';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  try {
    return withEventDb((db) => {
      const memberId = getMemberId(new URL(request.url).searchParams, request);
      if (!memberId) return Response.json({ success: true, data: [] });
      ensureEventOnline(db);
      const rows = db.prepare(`
        SELECT p.id, p.group_id, p.player_no, p.name, p.organization, p.teacher,
          p.status, p.audit_status, p.paid_status, p.score_status, p.registered_at,
          g.name AS group_name
        FROM event_players p
        LEFT JOIN event_groups g ON g.id=p.group_id
        WHERE p.competition_id=? AND (p.member_id=? OR p.submitted_by_member_id=?)
        ORDER BY p.id DESC
      `).all(routeParams.id, memberId, memberId).map((row: any) => ({
        id: row.id,
        groupId: row.group_id || null,
        groupName: row.group_name || '',
        playerNo: row.player_no || '',
        name: row.name,
        organization: row.organization || '',
        teacher: row.teacher || '',
        status: row.status || 'pending',
        auditStatus: row.audit_status || 'pending',
        paidStatus: row.paid_status || 'unpaid',
        scoreStatus: row.score_status || 'not_started',
        registeredAt: row.registered_at || '',
      }));
      return Response.json({ success: true, data: rows }, { headers: { 'Cache-Control': 'private, no-store' } });
    });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message || '报名记录加载失败' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  let savedFile: string | undefined;
  try {
    const memberId = getMemberId(new URL(request.url).searchParams, request);
    if (!memberId) return Response.json({ success: false, error: '请先登录后报名' }, { status: 401 });
    if (Number(request.headers.get('content-length')) > 256 * 1024 && request.headers.get('content-type')?.includes('application/json')) {
      throw new MusicUploadError('报名资料过长', 413);
    }
    const json = request.headers.get('content-type')?.includes('application/json');
    const input = json ? await request.json().catch(() => { throw new MusicUploadError('报名资料格式无效'); }) : null;
    const batch = input && Object.prototype.hasOwnProperty.call(input, 'entries');
    const key = batch ? input.requestKey : '';
    if (batch && (typeof key !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(key) ||
      !Array.isArray(input.entries) || input.entries.length < 1 || input.entries.length > 20)) {
      throw new MusicUploadError('请提交1至20条有效的报名信息');
    }
    const forms: FormData[] = batch ? input.entries.map(eventRegistrationForm)
      : [json ? eventRegistrationForm(input) : await normalizedMusicForm(request, { musicOptional: true })];
    const entries = await Promise.all(forms.map(async form => {
      const body = Object.fromEntries([...form.entries()].filter(([key]) => key !== 'musicFile'));
      const title = cleanText(body.performanceTitle);
      if (!title || title.length > 120) throw new MusicUploadError('请填写1至120字的节目名称');
      const music = form.get('musicFile') as File | null;
      const bytes = music ? Buffer.from(await music.arrayBuffer()) : null;
      if (music && bytes) await validatePlayableMusic(music.name, bytes);
      return { body, title, music, bytes };
    }));
    const hash = batch ? createHash('sha256').update(JSON.stringify(entries.map(entry => entry.body))).digest('hex') : '';
    return withEventDb((db) => db.transaction(() => {

      ensureEventOnline(db);
      let batchId = 0;
      if (batch) {
        const prior = db.prepare('SELECT request_hash, response FROM event_registration_batches WHERE member_id=? AND competition_id=? AND request_key=?').get(memberId, routeParams.id, key);
        if (prior) {
          if (prior.request_hash !== hash) throw new MusicUploadError('报名内容已变化，请重新提交', 409);
          return Response.json({ success: true, data: JSON.parse(prior.response) }, { headers: { 'Cache-Control': 'private, no-store' } });
        }
        batchId = Number(db.prepare('INSERT INTO event_registration_batches (member_id, competition_id, request_key, request_hash) VALUES (?,?,?,?)').run(memberId, routeParams.id, key, hash).lastInsertRowid);
      }
      const competition = db.prepare(`
        SELECT id, name, registration_status, registration_start, registration_end, end_date
        FROM event_competitions
        WHERE id=? AND status='published'
      `).get(routeParams.id);
      if (!competition) throw new MusicUploadError('赛事不存在或尚未发布', 404);
      const now = Date.now();
      const before = (value: string) => value && Date.parse(value) > now;
      const after = (value: string) => value && Date.parse(value) < now;
      if (competition.registration_status !== 'open' || before(competition.registration_start) ||
        after(competition.registration_end) || after(competition.end_date)) {
        throw new MusicUploadError('赛事报名尚未开放或已经结束', 409);
      }

      const registrations = entries.map(({ body, title, music, bytes }, index) => {
        try {
          const groupId = toNumber(body.groupId ?? body.group_id);
          const group = db.prepare(
            "SELECT id, max_players, registration_fee FROM event_groups WHERE id=? AND competition_id=? AND status='active'"
          ).get(groupId, routeParams.id);
          if (!group) throw new MusicUploadError('请选择有效的参赛组别');

          const member = db.prepare('SELECT name, phone FROM Member WHERE id=?').get(memberId) || {};
          const name = cleanText(body.name, cleanText(member.name));
          let phone: string;
          try {
            phone = normalizeEventPhone(cleanText(body.phone, cleanText(member.phone)), body.countryCode).phone;
          } catch (error) {
            throw new MusicUploadError(error instanceof Error ? error.message : '手机号格式错误', 400);
          }
          if (!name || name.length > 120) throw new MusicUploadError('请填写参赛姓名和手机号');

          const participantId=ensurePhoneMember(db,name,phone,'event_registration');
          const duplicate = db.prepare(`
            SELECT id,member_id,phone FROM event_players
            WHERE competition_id=? AND group_id=? AND (member_id=? OR REPLACE(REPLACE(REPLACE(COALESCE(phone,''),'+',''),' ',''),'-','')=?)
              AND status!='cancelled'
          `).all(routeParams.id, groupId, participantId, phone.replace(/\D/g, '')).find((row: any) => Number(row.member_id) === participantId || samePhoneIdentity(row.phone, phone));
          if (duplicate) throw new MusicUploadError('您已报名该赛事组别，可从个人中心继续缴费',409);

          const groupCount = db.prepare(
            "SELECT COUNT(*) AS count FROM event_players WHERE group_id=? AND status!='cancelled'"
          ).get(groupId)?.count || 0;
          if (group.max_players > 0 && groupCount >= group.max_players) {
            throw new MusicUploadError('该组别报名人数已满',409);
          }


          const result = db.prepare(`
            INSERT INTO event_players (
              competition_id, group_id, member_id, player_no, name, phone, gender,
              birthday, organization, teacher, status, audit_status, paid_status,
              score_status, remark, registered_at, updated_at, registration_fee, submitted_by_member_id, registration_batch_id
            ) VALUES (?, ?, ?, '', ?, ?, ?, ?, ?, ?, 'approved', 'approved', ?,
              'not_started', ?, ?, ?, ?, ?, ?)
          `).run(
            routeParams.id,
            groupId,
            participantId,
            name,
            phone,
            cleanText(body.gender),
            cleanText(body.birthday),
            cleanText(body.organization),
            cleanText(body.teacher),
            Number(group.registration_fee||0)>0?'unpaid':'paid',
            cleanText(body.remark),
            nowIso(),
            nowIso(),
            Number(group.registration_fee || 0),
            memberId,
            batchId,
          );
          let musicFileId: number | null = null;
          if (music && bytes) {
            const stored = persistEventMusic(music.name, bytes); savedFile = stored.file;
            const musicResult = db.prepare(`INSERT INTO event_music_files (competition_id,group_id,player_id,file_name,file_url,file_size,audit_status,uploaded_at,updated_at) VALUES (?,?,?,?,?,?,'pending',?,?)`).run(routeParams.id,groupId,result.lastInsertRowid,stored.name,stored.fileURL,bytes.length,nowIso(),nowIso());
            musicFileId = Number(musicResult.lastInsertRowid);
          }
          db.prepare(`INSERT INTO event_performances (competition_id,group_id,player_id,title,music_file_id,status,updated_at) VALUES (?,?,?,?,?,'pending',?)`).run(routeParams.id,groupId,result.lastInsertRowid,title,musicFileId,nowIso());
          createPersonalMessage(db, memberId, {
            type: 'event',
            title: '赛事报名已提交',
            content: `你已报名《${competition.name || '东方舞赛事'}》，可在个人中心查看缴费和成绩。`,
            actionUrl: '/dashboard/events',
            businessType: 'event_registration',
            businessId: result.lastInsertRowid,
            dedupeKey: `event-registration:${result.lastInsertRowid}`,
            priority: 'important',
          });

          return { id: Number(result.lastInsertRowid), registrationId: Number(result.lastInsertRowid), registrationFee: Number(group.registration_fee || 0), auditStatus: 'approved', musicFileId };
        } catch (error) {
          if (batch && error instanceof MusicUploadError) throw new MusicUploadError(`第 ${index + 1} 条报名：${error.message}`, error.status);
          throw error;
        }
      });
      const data = batch ? { registrations, paymentRegistrationId: registrations.find(row => row.registrationFee > 0)?.id || null } : registrations[0];
      if (batch) db.prepare('UPDATE event_registration_batches SET response=? WHERE id=?').run(JSON.stringify(data), batchId);
      return Response.json({ success: true, data }, { headers: { 'Cache-Control': 'private, no-store' } });
    }).immediate());
  } catch (err: any) {
    if (savedFile) { try { fs.unlinkSync(savedFile); } catch {} }
    return Response.json({ success: false, error: err instanceof MusicUploadError ? err.message : '赛事报名失败，请稍后重试' }, { status: err instanceof MusicUploadError ? err.status : 500 });
  }
}
