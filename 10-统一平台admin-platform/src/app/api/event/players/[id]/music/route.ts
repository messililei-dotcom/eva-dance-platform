import { hasAuth, unauthorized, withRequestEventDb } from '../../../_db';
import { normalizedMusicForm, validatePlayableMusic, MusicUploadError } from '@/lib/server/event-music-upload';
import { replacePlayerMusic } from '@/lib/server/event-player-music';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasAuth(request)) return unauthorized();
  const { id } = await params;
  try {
    const form = await normalizedMusicForm(request);
    const file = form.get('musicFile') as File;
    const bytes = Buffer.from(await file.arrayBuffer());
    await validatePlayableMusic(file.name, bytes);
    return withRequestEventDb(request, db => Response.json({ success: true, data: replacePlayerMusic(db, id, String(form.get('performanceTitle') || ''), file.name, bytes) }));
  } catch (error) {
    return Response.json({ success: false, error: error instanceof MusicUploadError ? error.message : '音乐上传失败，请重试' }, { status: error instanceof MusicUploadError ? error.status : 500 });
  }
}
