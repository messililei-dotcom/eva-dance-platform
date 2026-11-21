import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (
    request.headers.get('sec-fetch-site') === 'cross-site' ||
    (origin && origin !== new URL(request.url).origin && origin !== process.env.ADMIN_PUBLIC_ORIGIN)
  ) {
    return NextResponse.json({ error: '请求来源无效' }, { status: 403 });
  }

  const response = NextResponse.json({ success: true });
  const cookieOptions = {
    path: '/',
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
  };
  response.cookies.set('token', '', { ...cookieOptions, httpOnly: true });
  response.cookies.set('admin_media_token', '', cookieOptions);
  return response;
}
