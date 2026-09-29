import { openTrainingDb } from '@/app/api/training-db';
import { createConsultationAndNotifyStaff } from '@/lib/server/staff-inbox';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function clean(value: unknown) {
  return String(value ?? '').normalize('NFC').trim();
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const name = clean(body.name);
  const phone = clean(body.phone).replace(/\s+/g, '');
  const courseId = Number(body.courseId || body.course_id || 0);

  if (!name || !phone) {
    return Response.json({ success: false, error: '请填写姓名和手机号' }, { status: 400 });
  }
  if (!/^1\d{10}$/.test(phone)) {
    return Response.json({ success: false, error: '请输入正确的11位手机号' }, { status: 400 });
  }
  if (!Number.isInteger(courseId) || courseId < 1) {
    return Response.json({ success: false, error: '请选择线下课程' }, { status: 400 });
  }

  const db = openTrainingDb();
  try {
    const course = db.prepare(`
      SELECT course.id, course.name
      FROM Course course
      LEFT JOIN CourseTemplate template ON template.id=course.templateId
      WHERE course.id=?
        AND COALESCE(course.name, '') <> ''
        AND COALESCE(course.status, 'active') <> 'deleted'
        AND COALESCE(template.websiteVisible, 1)=1
      LIMIT 1
    `).get<{ id: number; name: string }>(courseId);
    if (!course) {
      return Response.json({ success: false, error: '所选线下课程不存在或已停止报名' }, { status: 400 });
    }
    const result = createConsultationAndNotifyStaff(db, {
      name,
      phone,
      courseId: course.id,
      courseName: course.name,
      channel: clean(body.channel) || 'website',
    });
    return Response.json({
      success: true,
      message: '咨询报名已提交，我们会尽快与您联系。',
      data: result,
    });
  } catch (error) {
    console.error('免费咨询报名失败:', error);
    return Response.json({ success: false, error: '提交失败，请稍后重试' }, { status: 500 });
  } finally {
    db.close();
  }
}
