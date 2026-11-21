import { getMemberId } from '../../../../_helpers';
import { withEventDb } from '../../../../../event/_db';
import { normalizedMusicForm, validatePlayableMusic, MusicUploadError } from '@/lib/server/event-music-upload';
import { playerMusic, replacePlayerMusic } from '@/lib/server/event-player-music';
import { memberMusicPreview } from '@/lib/server/member-music-preview';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
function failed(error: unknown) {
  return Response.json({ success: false, error: error instanceof MusicUploadError ? error.message : '音乐操作失败，请重试' }, { status: error instanceof MusicUploadError ? error.status : 500, headers: { 'Cache-Control': 'private, no-store' } });
}
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const memberId = getMemberId(new URL(request.url).searchParams, request);
  if (!memberId) return Response.json({ success: false, error: '请先登录' }, { status: 401 });
  const { id } = await params;
  try {
    return withEventDb(db => {
      const { player, performance, music } = playerMusic(db, id, memberId);
      if (new URL(request.url).searchParams.get('preview') === '1') return memberMusicPreview(request, music);
      return Response.json({ success: true, data: { performanceTitle: performance?.title || '', fileName: music?.file_name || '', musicFileId: music?.id || null, canEdit: !['cancelled','withdrawn'].includes(player.status) } }, { headers: { 'Cache-Control': 'private, no-store' } });
    });
  } catch (error) { return failed(error); }
}
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const memberId = getMemberId(new URL(request.url).searchParams, request);
  if (!memberId) return Response.json({ success: false, error: '请先登录' }, { status: 401 });
  const { id } = await params;
  try {
    withEventDb(db => playerMusic(db, id, memberId));
    const form = await normalizedMusicForm(request);
    const file = form.get('musicFile') as File;
    const bytes = Buffer.from(await file.arrayBuffer());
    const duration = await validatePlayableMusic(file.name, bytes);
    return withEventDb(db => Response.json({ success: true, data: replacePlayerMusic(db, id, String(form.get('performanceTitle') || ''), file.name, bytes, duration, memberId) }, { headers: { 'Cache-Control': 'private, no-store' } }));
  } catch (error) { return failed(error); }
}
