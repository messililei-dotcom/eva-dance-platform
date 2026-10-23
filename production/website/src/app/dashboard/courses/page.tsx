'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getStudentSession } from '@/lib/student-auth';

interface Course {
  id: number;
  courseId: number;
  courseName: string;
  amount: number;
  date: string;
  remainingSessions: number;
}

export default function MyCoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = getStudentSession();

    if (!session) {
      router.push('/?login=1&next=%2Fdashboard%2Fcourses');
      return;
    }

    fetch(`/api/payments?memberId=${session.id}`, {
      headers: { 'Authorization': `Bearer ${session.token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setCourses(data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return <div className="min-h-screen bg-warm-white flex items-center justify-center">加载中...</div>;
  }

  return (
    <div className="min-h-screen bg-warm-white py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-text mb-6">我的课程</h1>
        
        {courses.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center">
            <p className="text-text-secondary">暂无已购课程</p>
          </div>
        ) : (
          <div className="space-y-4">
            {courses.map((course) => (
              <div key={course.id} className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-text">{course.courseName}</h3>
                    <p className="text-text-secondary text-sm mt-1">购买日期：{course.date}</p>
                    <p className="text-text-secondary text-sm">支付金额：¥{course.amount}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-gold font-bold">剩余课次</div>
                    <div className="text-2xl font-bold text-text">{course.remainingSessions}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
