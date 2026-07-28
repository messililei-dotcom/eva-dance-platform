import { openAdminDb } from '@/lib/server/admin-db';
import { runInboxReminderJobs } from '@/lib/server/inbox';
import { hasAuth, jsonError, unauthorized } from '../../../training-db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function hasJobSecret(request: Request) {
  const expected = process.env.INBOX_JOB_SECRET || '';
  return Boolean(expected && request.headers.get('x-inbox-job-secret') === expected);
}

export async function POST(request: Request) {
  if (!hasJobSecret(request) && !hasAuth(request)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const db = openAdminDb();
  try {
    return Response.json({
      success: true,
      data: runInboxReminderJobs(db, String(body.referenceTime || body.reference_time || '') || undefined),
    });
  } catch (error: any) {
    return jsonError(error?.message || '提醒任务执行失败');
  } finally {
    db.close();
  }
}
