import {ensureEventOnline,ensurePhoneMember} from '@/lib/server/event-online';
import fs from 'node:fs';
import { normalizedMusicForm, validateMusicBytes, persistEventMusic, MusicUploadError } from '@/lib/server/event-music-upload';
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
      const rows = db.prepare(`
        SELECT p.id, p.group_id, p.player_no, p.name, p.organization, p.teacher,
          p.status, p.audit_status, p.paid_status, p.score_status, p.registered_at,
          g.name AS group_name
        FROM event_players p
        LEFT JOIN event_groups g ON g.id=p.group_id
        WHERE p.competition_id=? AND p.member_id=?
        ORDER BY p.id DESC
      `).all(routeParams.id, memberId).map((row: any) => ({
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
      return Response.json({ success: true, data: rows });
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
    const form = await normalizedMusicForm(request);
    const body = Object.fromEntries([...form.entries()].filter(([key]) => key !== 'musicFile'));
    const title = cleanText(body.performanceTitle);
    if (!title || title.length > 120) throw new MusicUploadError('请填写1至120字的节目名称');
    const music = form.get('musicFile') as File;
    const bytes = Buffer.from(await music.arrayBuffer()); validateMusicBytes(music.name, bytes);
    return withEventDb((db) => db.transaction(() => {

      ensureEventOnline(db);
      const competition = db.prepare(`
        SELECT id, name, registration_status
        FROM event_competitions
        WHERE id=? AND status='published'
      `).get(routeParams.id);
      if (!competition) return Response.json({ success: false, error: '赛事不存在或尚未发布' }, { status: 404 });
      if (competition.registration_status !== 'open') {
        return Response.json({ success: false, error: '赛事报名尚未开放或已经结束' }, { status: 409 });
      }

      const groupId = toNumber(body.groupId ?? body.group_id);
      const group = db.prepare(
        "SELECT id, max_players, registration_fee FROM event_groups WHERE id=? AND competition_id=? AND status='active'"
      ).get(groupId, routeParams.id);
      if (!group) return Response.json({ success: false, error: '请选择有效的参赛组别' }, { status: 400 });

      const member = db.prepare('SELECT name, phone FROM Member WHERE id=?').get(memberId) || {};
      const name = cleanText(body.name, cleanText(member.name));
      const phone = cleanText(body.phone, cleanText(member.phone));
      if (!name || name.length > 120 || !/^1[3-9]\d{9}$/.test(phone)) return Response.json({ success: false, error: '请填写参赛姓名和手机号' }, { status: 400 });

      const participantId=ensurePhoneMember(db,name,phone,'event_registration');
      const duplicate = db.prepare(`
        SELECT id FROM event_players
        WHERE competition_id=? AND group_id=? AND (member_id=? OR phone=?)
          AND status!='cancelled'
        LIMIT 1
      `).get(routeParams.id, groupId, participantId, phone);
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
          score_status, remark, registered_at, updated_at, registration_fee, submitted_by_member_id
        ) VALUES (?, ?, ?, '', ?, ?, ?, ?, ?, ?, 'approved', 'approved', ?,
          'not_started', ?, ?, ?, ?, ?)
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
      );
      const stored = persistEventMusic(music.name, bytes); savedFile = stored.file;
      const musicResult = db.prepare(`INSERT INTO event_music_files (competition_id,group_id,player_id,file_name,file_url,file_size,audit_status,uploaded_at,updated_at) VALUES (?,?,?,?,?,?,'pending',?,?)`).run(routeParams.id,groupId,result.lastInsertRowid,stored.name,stored.fileURL,bytes.length,nowIso(),nowIso());
      db.prepare(`INSERT INTO event_performances (competition_id,group_id,player_id,title,music_file_id,status,updated_at) VALUES (?,?,?,?,?,'pending',?)`).run(routeParams.id,groupId,result.lastInsertRowid,title,musicResult.lastInsertRowid,nowIso());
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

      return Response.json({ success: true, data: { id: result.lastInsertRowid, registrationId: result.lastInsertRowid, registrationFee:Number(group.registration_fee||0), auditStatus:'approved', musicFileId:musicResult.lastInsertRowid } });
    }).immediate());
  } catch (err: any) {
    if (savedFile) { try { fs.unlinkSync(savedFile); } catch {} }
    return Response.json({ success: false, error: err instanceof MusicUploadError ? err.message : '赛事报名失败，请稍后重试' }, { status: err instanceof MusicUploadError ? err.status : 500 });
  }
}
