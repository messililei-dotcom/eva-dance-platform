import { NextResponse } from 'next/server';
import { persistEventMusic, discardEventMusic } from '@/lib/server/event-music-archive';
import path from 'path';
import { getEventCompetitionId, getEventNewsBySlug } from '@/lib/events-news';
import { openAdminDb } from '@/lib/server/admin-db';
import { getAuthenticatedMemberId } from '@/app/api/mini/_helpers';

import { saveRegistrationMusic, readRegistrationMusic, removeRegistrationMusic } from '@/lib/server/event-registration-music';

import { ensurePhoneMember,ensureEventOnline } from "@/lib/server/event-online";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const searchWindows = new Map<number,{at:number,count:number}>();

type RouteContext = {
  params: Promise<{ slug: string }>;
};

type CompetitionRow = {
  id: number;
  name: string;
  registration_status: string;
  
  start_date: string;
  end_date: string;
  location: string;
};

const MUSIC_UPLOAD_ROOT = process.env.EVENT_MUSIC_UPLOAD_ROOT
  || '/www/wwwroot/dongfangwuquan/admin-platform/public/uploads/event-music';
const MAX_MUSIC_FILE_SIZE = 10 * 1024 * 1024;
const MUSIC_EXTENSIONS = new Set(['.mp3', '.wav', '.m4a', '.aac', '.flac']);

function cleanText(value: unknown, maxLength = 200): string {
  return String(value ?? '').trim().slice(0, maxLength);
}

function safePathSegment(value: string, fallback: string): string {
  const safe = value.trim().replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-').replace(/\s+/g, '-').slice(0, 80);
  return safe || fallback;
}

async function parseRegistrationBody(request: Request) {
  if (request.headers.get('content-type')?.includes('multipart/form-data')) {
    const formData = await request.formData();
    const values = Object.fromEntries(Array.from(formData.entries()).filter(([, value]) => typeof value === 'string'));
    const fileEntry = formData.get('musicFile');
    return {
      values,
      musicFile: fileEntry instanceof File && fileEntry.size > 0 ? fileEntry : null,
    };
  }

  return {
    values: await request.json().catch(() => ({})) as Record<string, unknown>,
    musicFile: null as File | null,
  };
}

function eventPayload(slug: string) {
  const item = getEventNewsBySlug(slug);
  if (!item || item.reportType === 'course') return null;

  const competitionId = getEventCompetitionId(item);
  if (!competitionId) return null;

  return { item, competitionId };
}

function loadCompetition(competitionId: number, memberId: number) {
  const db = openAdminDb({ readonly: true });
  try {
    const competition = db.prepare(`
      SELECT id, name, registration_status, start_date, end_date, location
      FROM event_competitions
      WHERE id = ?
    `).get<CompetitionRow>(competitionId);
    const groups = competition ? db.prepare(`
      SELECT id, name, age_range, dance_type, entry_type, registration_fee
      FROM event_groups
      WHERE competition_id = ? AND status = 'active'
      ORDER BY sort_order ASC, id ASC
    `).all<Record<string, unknown>>(competitionId) : [];
    const member = db.prepare(`
      SELECT COALESCE(name, '') AS name,
             COALESCE(phone, '') AS phone
      FROM Member WHERE id = ?
    `).get<{ name: string; phone: string }>(memberId);

    return { competition, groups, member };
  } finally {
    db.close();
  }
}

export async function GET(request: Request, { params }: RouteContext) {
  const memberId = getAuthenticatedMemberId(request);
  if (!memberId) {
    return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
  }
  const { slug } = await params;
  const event = eventPayload(slug);
  if (!event) {
    return NextResponse.json({ success: false, error: '赛事不存在' }, { status: 404 });
  }

  const musicPreview = new URL(request.url).searchParams.get('music');
  if (musicPreview) {
    try {
      const file = await readRegistrationMusic(musicPreview, memberId, event.competitionId);
      return new Response(await file.arrayBuffer(), { headers: { 'Content-Type': file.type.startsWith('audio/') ? file.type : 'application/octet-stream', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
    } catch (error) { return NextResponse.json({ success: false, error: error instanceof Error ? error.message : '音乐读取失败' }, { status: 400 }); }
  }
  const query = cleanText(new URL(request.url).searchParams.get('search'),40);
  if(query) {
    if(query.length<2)return NextResponse.json({success:true,matches:[]});
    const window=searchWindows.get(memberId),now=Date.now();
    if(window && now-window.at<60000 && window.count>=20)return NextResponse.json({success:false,error:'搜索过于频繁，请稍后再试'},{status:429});
    searchWindows.set(memberId,window && now-window.at<60000?{at:window.at,count:window.count+1}:{at:now,count:1});
    const db=openAdminDb({readonly:true});
    try {
      const escaped=query.replace(/[\\%_]/g,'\\$&');
      const rows=db.prepare("SELECT name,phone FROM Member WHERE COALESCE(status,'active')!='deleted' AND (name LIKE ? ESCAPE '\\' OR phone LIKE ? ESCAPE '\\') ORDER BY id DESC LIMIT 8").all<{name:string;phone:string}>('%'+escaped+'%','%'+escaped+'%');
      return NextResponse.json({success:true,matches:rows.map(m=>({name:m.name,phoneMasked:String(m.phone||'').slice(0,3)+'****'+String(m.phone||'').slice(-4)}))},{headers:{'Cache-Control':'private, no-store'}});
    }finally{db.close()}
  }

  try {
    const { competition, groups, member } = loadCompetition(event.competitionId, memberId);
    if (!competition) {
      return NextResponse.json({ success: false, error: '赛事报名信息未配置' }, { status: 404 });
    }

    const canRegister = competition.registration_status === 'open';

    return NextResponse.json({
      success: true,
      data: {
        slug: event.item.slug,
        title: event.item.title,
        dateRange: event.item.dateRange,
        location: event.item.location || competition.location,
        
        canRegister,
        member: {
          name: member?.name || '',
          phone: member?.phone || '',
        },
        groups: groups.map((group) => ({
          id: Number(group.id),
          name: String(group.name || ''),
          ageRange: String(group.age_range || ''),
          danceType: String(group.dance_type || ''),
          entryType: String(group.entry_type || ''),
          registrationFee: Number(group.registration_fee || 0),
        })),
      },
    });
  } catch (error) {
    console.error('加载赛事报名信息失败:', error);
    return NextResponse.json({ success: false, error: '报名信息加载失败' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  const memberId = getAuthenticatedMemberId(request);
  if (!memberId) {
    return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
  }
  const { slug } = await params;
  const event = eventPayload(slug);
  if (!event) {
    return NextResponse.json({ success: false, error: '赛事不存在' }, { status: 404 });
  }

  let parsed;
  try { parsed = await parseRegistrationBody(request); }
  catch { return NextResponse.json({ success: false, error: '上传内容读取失败，请重试' }, { status: 400 }); }
  const body = parsed.values;
  let musicFile = parsed.musicFile;
  if (new URL(request.url).searchParams.get('music') === 'upload') {
    try {
      const { competition } = loadCompetition(event.competitionId, memberId);
      if (!competition || competition.registration_status !== 'open') return NextResponse.json({ success: false, error: '该赛事当前未开放报名' }, { status: 409 });
      if (!musicFile) throw new Error('请选择需要上传的音乐文件');
      const data = await saveRegistrationMusic(musicFile, memberId, event.competitionId);
      return NextResponse.json({ success: true, message: '音乐上传成功', data }, { headers: { 'Cache-Control': 'private, no-store' } });
    } catch (error) { return NextResponse.json({ success: false, error: error instanceof Error ? error.message : '音乐上传失败，请重试' }, { status: 400 }); }
  }
  const musicUploadId = cleanText(body.musicUploadId, 36);
  if (musicUploadId) {
    try { musicFile = await readRegistrationMusic(musicUploadId, memberId, event.competitionId); }
    catch (error) { return NextResponse.json({ success: false, error: error instanceof Error ? error.message : '请重新上传音乐' }, { status: 400 }); }
  }
  if (cleanText(body.website)) {
    return NextResponse.json({ success: true, message: '报名信息已提交' });
  }

  const phone = cleanText(body.phone, 20).replace(/[\s-]/g, '').replace(/^\+?86/, '');
  const organization = cleanText(body.organization, 100);
  const teacher = cleanText(body.teacher, 60);
  const remark = cleanText(body.remark, 500);
  const groupId = Number(body.groupId || 0);
  const performanceTitle = cleanText(body.performanceTitle, 120);
  const musicSource = cleanText(body.musicSource, 20) === 'wechat' ? 'wechat' : 'local';

  if (!/^1[3-9]\d{9}$/.test(phone)) {
    return NextResponse.json({ success: false, error: '请填写正确的11位手机号' }, { status: 400 });
  }
  if (!performanceTitle) {
    return NextResponse.json({ success: false, error: '请填写节目名称' }, { status: 400 });
  }
  if (!musicFile) {
    return NextResponse.json({ success: false, error: '请选择需要上传的音乐文件' }, { status: 400 });
  }
  if (musicFile) {
    const extension = path.extname(musicFile.name).toLowerCase();
    if (musicFile.size > MAX_MUSIC_FILE_SIZE) {
      return NextResponse.json({ success: false, error: '音乐文件不能超过 10MB' }, { status: 413 });
    }
    if (!MUSIC_EXTENSIONS.has(extension)) {
      return NextResponse.json({ success: false, error: '请上传 MP3、WAV、M4A、AAC 或 FLAC 音乐文件' }, { status: 400 });
    }
  }

  const db = openAdminDb();
  ensureEventOnline(db);
  let uploadedMusic: Awaited<ReturnType<typeof persistEventMusic>> | null = null;
  try {
    const competition = db.prepare(`
      SELECT id, name, registration_status FROM event_competitions WHERE id = ?
    `).get<{ id: number; name: string; registration_status: string }>(event.competitionId);

    if (!competition || competition.registration_status !== 'open') {
      return NextResponse.json({ success: false, error: '该赛事当前未开放报名' }, { status: 409 });
    }

    const member = db.prepare(`
      SELECT id, COALESCE(name, '') AS name FROM Member WHERE id = ?
    `).get<{ id: number; name: string }>(memberId);
    if (!member) {
      return NextResponse.json({ success: false, error: '登录状态无效，请重新登录' }, { status: 401 });
    }
    const name = cleanText(body.name, 30);
    if (name.length < 2) {
      return NextResponse.json({ success: false, error: '请填写参赛选手姓名' }, { status: 400 });
    }

    let selectedGroup: { id: number; name: string; registration_fee:number } | undefined;
    if(!groupId) return NextResponse.json({success:false,error:'请选择报名组别'}, {status:400});
    if (groupId) {
      selectedGroup = db.prepare(`
        SELECT id, name, registration_fee FROM event_groups
        WHERE id = ? AND competition_id = ? AND status = 'active'
      `).get<{ id: number; name: string; registration_fee:number }>(groupId, event.competitionId);
      if (!selectedGroup) {
        return NextResponse.json({ success: false, error: '所选赛事组别无效' }, { status: 400 });
      }
    }

    const duplicate = db.prepare(`
      SELECT id,member_id,submitted_by_member_id,registration_fee,paid_status FROM event_players
      WHERE competition_id = ?
        AND REPLACE(REPLACE(REPLACE(COALESCE(phone, ''), ' ', ''), '-', ''), '+86', '') = ?
        AND audit_status <> 'rejected' AND status NOT IN ('cancelled','withdrawn') AND COALESCE(group_id,0)=?
      LIMIT 1
    `).get(event.competitionId, phone, groupId);
    if (duplicate && [duplicate.member_id,duplicate.submitted_by_member_id].includes(memberId) && duplicate.paid_status==='unpaid') return NextResponse.json({success:true,data:{registrationId:duplicate.id,registrationFee:Number(duplicate.registration_fee)},message:'报名已存在，请继续缴费'});
    if (duplicate) {
      return NextResponse.json({ success: false, error: '该手机号已报名本组别' }, { status: 409 });
    }

    uploadedMusic = await persistEventMusic(musicFile!, event.competitionId, competition.name, selectedGroup!.name, name, performanceTitle);
    db.exec(`CREATE TABLE IF NOT EXISTS event_music_archives (
  id INTEGER PRIMARY KEY AUTOINCREMENT, competition_id INTEGER NOT NULL, music_file_id INTEGER NOT NULL UNIQUE,
  vod_id TEXT NOT NULL DEFAULT '', category_id INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'local',
  FOREIGN KEY(music_file_id) REFERENCES event_music_files(id) ON DELETE CASCADE
);`);

    const musicSourceLabel = musicSource === 'wechat' ? '音乐来源：微信聊天记录' : '音乐来源：选取文件';
    const notes = [musicSourceLabel, remark].filter(Boolean).join('\n');
    const now = new Date().toISOString();
    const created = db.transaction(() => {
      // Recheck limits inside the write transaction, including concurrent registrations.
      const live = db.prepare('SELECT * FROM event_competitions WHERE id=?').get<any>(event.competitionId);
      if (!live || live.registration_status !== 'open') throw new Error('该赛事当前未开放报名');
      
      if (!groupId) throw new Error('请选择有效的参赛组别');
      const liveGroup = db.prepare("SELECT * FROM event_groups WHERE id=? AND competition_id=? AND status='active'").get<any>(groupId,event.competitionId);
      if (!liveGroup) throw new Error('请选择有效的参赛组别');
      const entrantId=ensurePhoneMember(db,name,phone,'event_competition');
      if (db.prepare("SELECT id FROM event_players WHERE competition_id=? AND group_id=? AND (member_id=? OR REPLACE(REPLACE(REPLACE(COALESCE(phone,''),' ',''),'-',''),'+86','')=?) AND audit_status<>'rejected' AND status NOT IN ('cancelled','withdrawn')").get(event.competitionId,groupId,entrantId,phone)) throw new Error('您已报名本组别');
      const groupCount = db.prepare("SELECT COUNT(*) n FROM event_players WHERE group_id=? AND status NOT IN ('cancelled','withdrawn') AND audit_status<>'rejected'").get<any>(groupId).n;

      if (liveGroup.max_players > 0 && groupCount >= liveGroup.max_players) throw new Error('该组别报名人数已满');

      const playerResult = db.prepare(`
        INSERT INTO event_players (
          competition_id, group_id, member_id, name, phone, organization, teacher,
          status, audit_status, paid_status, score_status, remark, updated_at,registration_fee,submitted_by_member_id,registered_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', 'approved', 'unpaid', 'not_started', ?, ?,?,?,?)
      `).run(event.competitionId, groupId, entrantId, name, phone, organization, teacher, notes, now,Number(liveGroup.registration_fee||0),memberId,now);
      const playerId = Number(playerResult.lastInsertRowid);

      let musicFileId: number | null = null;
      if (uploadedMusic) {
        const musicResult = db.prepare(`
          INSERT INTO event_music_files (
            competition_id, group_id, player_id, file_name, file_url, file_size,
            duration_seconds, audit_status, uploaded_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?)
        `).run(event.competitionId, groupId || null, playerId, uploadedMusic.fileName, uploadedMusic.fileUrl, uploadedMusic.fileSize, uploadedMusic.duration, now, now);
        musicFileId = Number(musicResult.lastInsertRowid);
        db.prepare('INSERT INTO event_music_archives(competition_id,music_file_id,vod_id,category_id,status) VALUES(?,?,?,?,?)').run(event.competitionId,musicFileId,uploadedMusic.vodId,uploadedMusic.categoryId,uploadedMusic.status);
      }

      db.prepare(`
        INSERT INTO event_performances (
          competition_id, group_id, player_id, title, music_file_id, status, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'pending', ?)
      `).run(event.competitionId, groupId || null, playerId, performanceTitle, musicFileId, now);

      return { playerId, musicFileId,registrationFee:Number(liveGroup.registration_fee||0) };
    })();

    if (musicUploadId) await removeRegistrationMusic(musicUploadId);
    return NextResponse.json({
      success: true,
      message: created.registrationFee>0?'报名已提交，请继续缴费。':'报名已提交，该组别无需缴费。',
      data: { registrationId: created.playerId, musicFileId: created.musicFileId,registrationFee:created.registrationFee },
    });
  } catch (error) {
    if (uploadedMusic) await discardEventMusic(uploadedMusic);
    console.error('赛事报名提交失败:', error);
    const message = error instanceof Error ? error.message : '';
    const expected = ['该赛事当前未开放报名','赛事报名尚未开始','赛事报名已经结束','请选择有效的参赛组别','您已报名本组别','该组别报名人数已满','赛事报名人数已满','音乐文件无法读取，请上传有效的 MP3、WAV、M4A、AAC 或 FLAC 音频'].includes(message);
    return NextResponse.json({ success: false, error: expected ? message : '报名提交失败，请稍后重试' }, { status: expected ? 409 : 500 });
  } finally {
    db.close();
  }
}
