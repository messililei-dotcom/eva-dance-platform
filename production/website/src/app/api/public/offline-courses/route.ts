import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function platformApiBase() {
  const configured = process.env.STUDENT_API_URL
    || process.env.MANAGEMENT_API_BASE
    || process.env.NEXT_PUBLIC_API_URL
    || '';
  if (!configured || /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(configured)) {
    return 'https://admin.swod.com.cn/api';
  }
  return configured.replace(/\/$/, '');
}

export async function GET() {
  try {
    const response = await fetch(`${platformApiBase()}/mini/public/offline-courses`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(payload, { status: response.status });
    }
    const courses = Array.isArray(payload)
      ? payload
      : Array.isArray(payload.data)
        ? payload.data
        : [];
    return NextResponse.json({ success: true, data: courses });
  } catch (error) {
    console.error('同步数字化平台线下课程失败:', error);
    return NextResponse.json(
      { success: false, error: '线下课程列表暂时无法加载' },
      { status: 502 },
    );
  }
}
