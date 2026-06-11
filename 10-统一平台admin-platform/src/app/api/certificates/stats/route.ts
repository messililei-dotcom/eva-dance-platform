import { openAdminDb } from '@/lib/server/admin-db';
import { ensureCertificateSchema } from '@/lib/server/certificates';
import { verifyLocalToken } from '@/app/api/_local-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function hasAuth(request: Request): boolean {
  const bearerToken = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (bearerToken && verifyLocalToken(bearerToken)) return true;

  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const cookieToken = cookieHeader
      .split(';')
      .map(c => c.trim())
      .find(c => c.startsWith('token='))
      ?.split('=')[1]?.trim();
    if (cookieToken && verifyLocalToken(cookieToken)) return true;
  }

  return false;
}

export async function GET(request: Request) {
  if (!hasAuth(request)) {
    return Response.json({ success: false, error: '未登录' }, { status: 401 });
  }

  const db = openAdminDb();
  try {
    ensureCertificateSchema(db);
    const total = db.prepare('SELECT COUNT(*) AS count FROM Certificate').get()?.count || 0;
    const active = db.prepare("SELECT COUNT(*) AS count FROM Certificate WHERE status = 'active'").get()?.count || 0;
    const auto = db.prepare("SELECT COUNT(*) AS count FROM Certificate WHERE issue_method = 'auto'").get()?.count || 0;
    const templates = db.prepare('SELECT COUNT(*) AS count FROM CertificateTemplate').get()?.count || 0;
    return Response.json({ total, active, revoked: total - active, auto, templates });
  } finally {
    db.close();
  }
}
