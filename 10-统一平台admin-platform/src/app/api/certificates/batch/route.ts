import { openTrainingDb, hasAuth, unauthorized, hasPermission, forbidden } from '../../training-db';
import { ensureCertificateSchema } from '@/lib/server/certificates';
import { certificateRoster, issueCertificateBatch } from '@/lib/server/certificate-batch';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function handle(request: Request, issue: boolean) {
  if (!hasAuth(request)) return unauthorized();
  const body = issue ? await request.json().catch(() => ({})) : {};
  const seriesId = Number(issue ? body.seriesId : new URL(request.url).searchParams.get('seriesId'));
  if (!Number.isSafeInteger(seriesId) || !seriesId) return Response.json({ error: '请选择课程及期次' }, { status: 400 });
  const permission = seriesId < 0 ? (issue ? 'permCourseEdit' : 'permCourseView') : (issue ? 'permOnlineAuthCreate' : 'permOnlineCourseView');
  if (!hasPermission(request, permission)) return forbidden('无权限查看或颁发课程证书');
  const ids = Array.isArray(body.memberIds) ? [...new Set<number>(body.memberIds.map(Number))] : [];
  if (issue && (!ids.length || ids.length > 2000 || ids.some(id => !Number.isSafeInteger(id) || id <= 0))) return Response.json({ error: '请选择有效学员，每次最多颁发 2000 人' }, { status: 400 });
  const db = openTrainingDb();
  try {
    ensureCertificateSchema(db);
    const data = issue ? await issueCertificateBatch(db, seriesId, ids) : certificateRoster(db, seriesId);
    return Response.json({ success: true, data });
  } catch (error: any) {
    return Response.json({ success: false, error: error.message || '证书操作失败' }, { status: 400 });
  } finally { db.close(); }
}
export async function GET(request: Request) { return handle(request, false); }
export async function POST(request: Request) { return handle(request, true); }
