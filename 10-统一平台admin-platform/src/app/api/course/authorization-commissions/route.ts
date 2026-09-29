import { hasAuth, openTrainingDb, unauthorized } from '../../training-db';
import { onlineAuthorizationCommissions } from '@/lib/server/authorization-commission';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const db = openTrainingDb();
  try { return Response.json(onlineAuthorizationCommissions(db)); }
  finally { db.close(); }
}
