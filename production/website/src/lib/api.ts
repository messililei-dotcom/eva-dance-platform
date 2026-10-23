const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://admin.swod.com.cn/api';

function normalizeCourse(row: any) {
  return {
    ...row,
    displayName: row.displayName || row.display_name || row.name,
    officialCourseName: row.officialCourseName || row.official_course_name || row.name,
    type: row.type || row.category,
    subType: row.subType || row.sub_type || row.subtitle,
    startDate: row.startDate || row.start_date || '',
    endDate: row.endDate || row.end_date || '',
    sessions: Number(row.sessions || row.total_courses || 0),
    content: row.content || row.description || '',
  };
}

// 获取公开课程列表（从统一后台公开接口）
export async function getPublicCourses() {
  try {
    const res = await fetch(`${API_BASE}/mini/public/offline-courses`, {
      cache: 'no-store', // 不缓存，确保数据实时性
    });
    const data = await res.json();
    return (Array.isArray(data) ? data : data.data || []).map(normalizeCourse);
  } catch (error) {
    console.error('获取课程列表失败:', error);
    return [];
  }
}

// 获取数字化平台公开展示的线下课程（官网同源接口）
export async function getPublicOfflineCourseOptions() {
  try {
    const res = await fetch('/api/public/offline-courses', { cache: 'no-store' });
    const data = await res.json();
    return data.success && Array.isArray(data.data) ? data.data : [];
  } catch (error) {
    console.error('获取数字化平台线下课程失败:', error);
    return [];
  }
}

// 获取即将开始的课程
export async function getUpcomingCourses() {
  try {
    const res = await fetch(`${API_BASE}/mini/public/offline-courses`, {
      cache: 'no-store',
    });
    const data = await res.json();
    const courses = (Array.isArray(data) ? data : data.data || []).map(normalizeCourse);
    const today = new Date().toISOString().split('T')[0];
    return courses.filter((course: any) => !course.startDate || course.startDate >= today);
  } catch (error) {
    console.error('获取即将开始的课程失败:', error);
    return [];
  }
}

// 获取课程详情
export async function getCourseById(id: number) {
  try {
    const res = await fetch(`${API_BASE}/mini/public/offline-courses`, {
      cache: 'no-store',
    });
    const data = await res.json();
    const courses = (Array.isArray(data) ? data : data.data || []).map(normalizeCourse);
    return courses.find((course: any) => {
      const ids = [course.id, course.source_id, course.sourceId].filter(Boolean).map(String);
      return ids.includes(String(id));
    }) || null;
  } catch (error) {
    console.error('获取课程详情失败:', error);
    return null;
  }
}

// 免费咨询报名
export async function enrollCourse(data: {
  name: string;
  phone: string;
  courseId: string | number;
  channel?: string;
}) {
  try {
    const res = await fetch('/api/public/enroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return await res.json();
  } catch (error) {
    console.error('咨询报名失败:', error);
    return { success: false, error: '提交失败，请稍后重试' };
  }
}

// 获取省市区数据
export async function getRegions() {
  try {
    const res = await fetch(`${API_BASE}/public/regions`);
    const data = await res.json();
    return data.success ? data.data : [];
  } catch (error) {
    console.error('获取省市区数据失败:', error);
    return [];
  }
}
