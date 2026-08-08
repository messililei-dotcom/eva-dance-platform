import fs from 'node:fs';
import path from 'node:path';
import { getMemberId } from '../../../_helpers';
import { cleanText, nowIso, toNumber, withEventDb } from '../../../../event/_db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_MUSIC_FILE_SIZE = 10 * 1024 * 1024;
const MUSIC_EXTENSIONS = new Set(['.mp3', '.wav', '.m4a', '.aac', '.flac']);
const MUSIC_UPLOAD_ROOT = process.env.EVENT_MUSIC_UPLOAD_ROOT
  || path.join(process.cwd(), 'public', 'uploads', 'event-music');

function safePathSegment(value: unknown, fallback: string) {
  const safe = cleanText(value, fallback).replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-').replace(/\s+/g, '-').slice(0, 80);
  return safe || fallback;
}

async function parseRegistrationBody(request: Request) {
  if (request.headers.get('content-type')?.includes('multipart/form-data')) {
    const formData = await request.formData();
    const body: Record<string, unknown> = {};
    formData.forEach((value, key) => {
      if (typeof value === 'string') body[key] = value;
    });
    const entry = formData.get('musicFile');
    const musicFile = entry && typeof entry !== 'string' && entry.size > 0 ? entry : null;
    return { body, musicFile };
  }
  return {
    body: await request.json().catch(() => ({})) as Record<string, unknown>,
    musicFile: null as File | null,
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  try {
    return withEventDb((db) => {
      const memberId = getMemberId(new URL(request.url).searchParams, request);
      if (!memberId) return Response.json({ success: true, data: [] });
      const rows = db.prepare(`
        SELECT p.id, p.group_id, p.player_no, p.name, p.organization, p.teacher,
          p.status, p.audit_status, p.paid_status, p.score_status, p.registered_at,
          g.name AS group_name,
          COALESCE((SELECT pf.title FROM event_performances pf WHERE pf.player_id=p.id ORDER BY pf.id DESC LIMIT 1), '') AS performance_title,
          r.published_total, r.rank_no, r.status AS ranking_status, a.name AS award_name
        FROM event_players p
        LEFT JOIN event_groups g ON g.id=p.group_id
        LEFT JOIN event_rankings r ON r.player_id=p.id AND r.group_id=p.group_id AND r.status='published'
        LEFT JOIN event_awards a ON a.id=r.award_id
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
        performanceTitle: row.performance_title || '',
        resultPublished: row.ranking_status === 'published',
        totalScore: row.ranking_status === 'published' && row.published_total != null ? Number(row.published_total) : null,
        rankNo: row.ranking_status === 'published' ? Number(row.rank_no || 0) : 0,
        awardName: row.ranking_status === 'published'
          ? row.award_name || (Number(row.rank_no || 0) > 0 ? `第 ${Number(row.rank_no)} 名` : '')
          : '',
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
  const { body, musicFile } = await parseRegistrationBody(request);
  let musicBuffer: Buffer | null = null;
  let savedMusicPath = '';
  if (!musicFile) {
    return Response.json({ success: false, error: '请选择需要上传的音乐文件' }, { status: 400 });
  }
  const musicExtension = path.extname(musicFile.name).toLowerCase();
  if (musicFile.size > MAX_MUSIC_FILE_SIZE) {
    return Response.json({ success: false, error: '音乐文件不能超过 10MB' }, { status: 413 });
  }
  if (!MUSIC_EXTENSIONS.has(musicExtension) && !musicFile.type.toLowerCase().startsWith('audio/')) {
    return Response.json({ success: false, error: '请上传 MP3、WAV、M4A、AAC 或 FLAC 音乐文件' }, { status: 400 });
  }
  musicBuffer = Buffer.from(await musicFile.arrayBuffer());
  try {
    return withEventDb((db) => {
      const memberId = getMemberId(new URL(request.url).searchParams, request);
      if (!memberId) return Response.json({ success: false, error: '请先登录后报名' }, { status: 401 });

      const competition = db.prepare(`
        SELECT id, registration_status, registration_start, registration_end, max_players
        FROM event_competitions
        WHERE id=? AND status='published'
      `).get(routeParams.id);
      if (!competition) return Response.json({ success: false, error: '赛事不存在或尚未发布' }, { status: 404 });
      if (competition.registration_status !== 'open') {
        return Response.json({ success: false, error: '赛事报名尚未开放或已经结束' }, { status: 409 });
      }
      const now = Date.now();
      if (competition.registration_start && now < Date.parse(competition.registration_start)) {
        return Response.json({ success: false, error: '赛事报名尚未开始' }, { status: 409 });
      }
      if (competition.registration_end && now > Date.parse(competition.registration_end)) {
        return Response.json({ success: false, error: '赛事报名已经结束' }, { status: 409 });
      }

      const groupId = toNumber(body.groupId ?? body.group_id);
      const group = db.prepare(
        "SELECT id, max_players FROM event_groups WHERE id=? AND competition_id=? AND status='active'"
      ).get(groupId, routeParams.id);
      if (!group) return Response.json({ success: false, error: '请选择有效的参赛组别' }, { status: 400 });

      const member = db.prepare('SELECT name, phone FROM Member WHERE id=?').get(memberId) || {};
      const name = cleanText(body.name, cleanText(member.name));
      const phone = cleanText(body.phone, cleanText(member.phone)).replace(/[\s-]/g, '').replace(/^\+?86/, '');
      if (!name || !phone) return Response.json({ success: false, error: '请填写参赛姓名和手机号' }, { status: 400 });
      if (!/^1[3-9]\d{9}$/.test(phone)) {
        return Response.json({ success: false, error: '请填写正确的11位手机号' }, { status: 400 });
      }
      const performanceTitle = cleanText(body.performanceTitle ?? body.performance_title);
      if (!performanceTitle) return Response.json({ success: false, error: '请填写参赛曲目' }, { status: 400 });

      const duplicate = db.prepare(`
        SELECT id FROM event_players
        WHERE competition_id=? AND group_id=? AND (member_id=? OR phone=?)
          AND status!='cancelled'
        LIMIT 1
      `).get(routeParams.id, groupId, memberId, phone);
      if (duplicate) return Response.json({ success: false, error: '您已报名该赛事组别' }, { status: 409 });

      const groupCount = db.prepare(
        "SELECT COUNT(*) AS count FROM event_players WHERE group_id=? AND status!='cancelled'"
      ).get(groupId)?.count || 0;
      if (group.max_players > 0 && groupCount >= group.max_players) {
        return Response.json({ success: false, error: '该组别报名人数已满' }, { status: 409 });
      }

      const totalCount = db.prepare(
        "SELECT COUNT(*) AS count FROM event_players WHERE competition_id=? AND status!='cancelled'"
      ).get(routeParams.id)?.count || 0;
      if (competition.max_players > 0 && totalCount >= competition.max_players) {
        return Response.json({ success: false, error: '赛事报名人数已满' }, { status: 409 });
      }

      const created = db.transaction(() => {
        const now = nowIso();
        const result = db.prepare(`
          INSERT INTO event_players (
            competition_id, group_id, member_id, player_no, name, phone, gender,
            birthday, organization, teacher, status, audit_status, paid_status,
            score_status, remark, registered_at, updated_at
          ) VALUES (?, ?, ?, '', ?, ?, ?, ?, ?, ?, 'pending', 'pending', 'unpaid',
            'not_started', ?, ?, ?)
        `).run(
          routeParams.id, groupId, memberId, name, phone, cleanText(body.gender),
          cleanText(body.birthday), cleanText(body.organization), cleanText(body.teacher),
          cleanText(body.remark), now, now,
        );
        const playerId = Number(result.lastInsertRowid);
        const eventFolder = `${routeParams.id}-${safePathSegment(competition.name, '赛事')}`;
        const groupFolder = safePathSegment(group.name, '待确认组别');
        const uploadDir = path.join(MUSIC_UPLOAD_ROOT, eventFolder, groupFolder);
        fs.mkdirSync(uploadDir, { recursive: true });
        const fileName = `${Date.now()}-${safePathSegment(name, '选手')}-${safePathSegment(performanceTitle, '参赛曲目')}${musicExtension || '.mp3'}`;
        savedMusicPath = path.join(uploadDir, fileName);
        fs.writeFileSync(savedMusicPath, musicBuffer!);
        const fileUrl = path.posix.join('/uploads/event-music', eventFolder, groupFolder, fileName);
        const musicResult = db.prepare(`
          INSERT INTO event_music_files (
            competition_id, group_id, player_id, file_name, file_url, file_size,
            audit_status, uploaded_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
        `).run(routeParams.id, groupId, playerId, fileName, fileUrl, musicFile.size, now, now);
        const musicFileId = Number(musicResult.lastInsertRowid);
        db.prepare(`
          INSERT INTO event_performances (
            competition_id, group_id, player_id, title, music_file_id, status, updated_at
          ) VALUES (?, ?, ?, ?, ?, 'pending', ?)
        `).run(routeParams.id, groupId, playerId, performanceTitle, musicFileId, now);
        return { playerId, musicFileId };
      })();

      return Response.json({
        success: true,
        message: '报名信息已提交，工作人员将尽快联系您确认组别与缴费事宜。',
        data: { id: created.playerId, musicFileId: created.musicFileId, auditStatus: 'pending' },
      });
    });
  } catch (err: any) {
    if (savedMusicPath) {
      try { fs.unlinkSync(savedMusicPath); } catch {}
    }
    return Response.json({ success: false, error: err.message || '赛事报名失败' }, { status: 500 });
  }
}
