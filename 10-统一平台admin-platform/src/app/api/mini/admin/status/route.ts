import { getMemberId, isMiniAdmin, jsonError, withDb } from '../../_helpers';

export async function GET(request: Request) {
  try {
    return withDb((db) => {
      const memberId = getMemberId(new URL(request.url).searchParams, request);
      return Response.json({ success: true, data: { isAdmin: isMiniAdmin(db, memberId), is_admin: isMiniAdmin(db, memberId) } });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
