import { NextResponse } from 'next/server';
import { offlineCourses } from '@/data/training-calendar';

export const dynamic = 'force-dynamic';

const API_BASE = process.env.STUDENT_API_URL
  || process.env.NEXT_PUBLIC_API_URL
  || 'https://admin.swod.com.cn/api';

/**
 * API 路由：获取线下集训课程数据
 * GET /api/courses
 * 
 * 返回所有线下集训课程列表，用于课程日历页面展示
 */
export async function GET() {
  try {
    const res = await fetch(`${API_BASE}/public/courses`, { cache: 'no-store' });
    const data = await res.json();
    const courses = Array.isArray(data) ? data : data.data || [];

    return NextResponse.json({
      success: true,
      data: courses,
      total: courses.length,
    });
  } catch (error) {
    console.error('获取课程数据失败:', error);
    return NextResponse.json({
      success: true,
      data: offlineCourses,
      total: offlineCourses.length,
      fallback: true,
    });
  }
}
