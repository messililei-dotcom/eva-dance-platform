import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// 学员管理系统报名API地址
const MANAGEMENT_API = process.env.MANAGEMENT_API_URL || 'https://admin.swod.com.cn/api/public/enroll';

/**
 * API 路由：学员报名（官网调用）
 * POST /api/enroll
 * 
 * 将报名信息提交到学员管理系统
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 参数校验
    if (!body.memberName || !body.memberPhone || !body.sessionId) {
      return NextResponse.json({
        success: false,
        error: '缺少必要参数：姓名、手机号、课程ID'
      }, { status: 400 });
    }

    // 调用学员管理系统报名接口
    const response = await fetch(MANAGEMENT_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memberName: body.memberName.trim(),
        memberPhone: body.memberPhone.trim(),
        sessionId: parseInt(body.sessionId),
        paymentMethod: body.paymentMethod || '微信',
        remark: body.remark || ''
      }),
      // 设置超时10秒
      signal: AbortSignal.timeout(10000)
    });

    const result = await response.json();

    if (!result.success) {
      console.warn('报名失败:', result.error);
      return NextResponse.json({
        success: false,
        error: result.error || '报名失败，请稍后重试'
      }, { status: 400 });
    }

    // 报名成功
    return NextResponse.json({
      success: true,
      message: '报名成功！已提交审核，请等待确认',
      data: result.data
    });

  } catch (error: any) {
    console.error('报名请求失败:', error?.message || error);
    
    // 区分错误类型
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
