import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const API_BASE = process.env.STUDENT_API_URL
  || process.env.NEXT_PUBLIC_API_URL
  || 'https://admin.swod.com.cn/api';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const res = await fetch(`${API_BASE}/public/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('代理免费咨询报名失败:', error);
    return NextResponse.json(
      { success: false, error: '无法连接学员管理系统报名接口' },
      { status: 502 },
    );
  }
}
