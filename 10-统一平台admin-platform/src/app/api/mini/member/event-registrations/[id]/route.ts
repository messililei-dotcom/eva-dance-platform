import { getMemberId } from '../../../_helpers';
import { withEventDb } from '../../../../event/_db';
import { registrationDetails, updateRegistrationDetails } from '@/lib/server/event-registration-details';
import { MusicUploadError } from '@/lib/server/event-music-upload';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };
async function handle(request: Request, context: Context) {
  const memberId = getMemberId(new URL(request.url).searchParams, request);
  if (!memberId) return Response.json({ success: false, error: '请先登录' }, { status: 401 });
  try {
    const { id } = await context.params;
    const body = request.method === 'PUT' ? await request.json() : null;
    if (request.method === 'PUT' && (!body || typeof body !== 'object' || Array.isArray(body))) throw new MusicUploadError('报名信息格式不正确');
    const data = withEventDb(db => request.method === 'PUT' ? updateRegistrationDetails(db, id, memberId, body) : registrationDetails(db, id, memberId));
    return Response.json({ success: true, data }, { headers: { 'Cache-Control': 'private, no-store', Vary: 'Authorization, Cookie' } });
  } catch (error) {
    return Response.json({ success: false, error: error instanceof MusicUploadError ? error.message : '报名信息操作失败，请重试' }, { status: error instanceof MusicUploadError ? error.status : 500 });
  }
}
export async function GET(request: Request, context: Context) { return handle(request, context); }
export async function PUT(request: Request, context: Context) { return handle(request, context); }
