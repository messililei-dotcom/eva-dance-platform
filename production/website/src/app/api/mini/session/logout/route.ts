import {
  clearMemberSessionCookie,
  revokeMemberDeviceSession,
  withDb,
} from '../../_helpers';

export async function POST(request: Request) {
  withDb((db) => revokeMemberDeviceSession(db, request));
  return clearMemberSessionCookie(Response.json({ success: true }));
}
