import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// 学员管理系统API地址
const MANAGEMENT_API = process.env.MANAGEMENT_API_URL || 'https://admin.swod.com.cn/api/public/member';

/**
 * API 路由：学员课程查询（官网调用）
 * GET /api/member?phone=xxx
 * 
 * 查询学员的已购课程和报名记录
 */
export async function GET(request: NextRequest) {
  try {
    const phone = request.nextUrl.searchParams.get('phone');

    if (!phone) {
      return NextResponse.json({
        success: false,
        error: '请提供手机号'
      }, { status: 400 });
    }

    // 手机号格式校验
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return NextResponse.json({
        success: false,
        error: '手机号格式不正确'
      }, { status: 400 });
    }

    // 调用学员管理系统查询接口
    const response = await fetch(`${MANAGEMENT_API}/${phone}/courses`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      // 设置超时5秒
      signal: AbortSignal.timeout(5000)
    });

    const result = await response.json();

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error || '未找到学员信息'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: result.data
    });

  } catch (error: any) {
    console.error('学员查询请求失败:', error?.message || error);
    
    if (error?.name === 'TimeoutError' || error?.message?.includes('timeout')) {
      return NextResponse.json({
        success: false,
        error: '系统连接超时，请稍后重试'
      }, { status: 504 });
    }

    return NextResponse.json({
      success: false,
      error: '系统连接失败，请稍后重试'
    }, { status: 500 });
  }
}
