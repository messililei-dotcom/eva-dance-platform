'use client';

import { useEffect, useState } from 'react';
import { enrollCourse, getPublicOfflineCourseOptions } from '@/lib/api';

type OfflineCourseOption = {
  id: string;
  name: string;
  startDate: string;
};

export default function EnrollPage() {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    courseId: '',
    channel: 'website',
  });
  const [courses, setCourses] = useState<OfflineCourseOption[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    getPublicOfflineCourseOptions()
      .then((rows) => {
        if (!active) return;
        setCourses(rows.map((course: any) => ({
          id: String(course.source_id || course.sourceId || course.platformCourseId || course.id || ''),
          name: String(course.title || course.name || '线下课程'),
          startDate: String(course.startDate || course.start_date || ''),
        })).filter((course: OfflineCourseOption) => course.id));
      })
      .finally(() => {
        if (active) setCoursesLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !/^1\d{10}$/.test(formData.phone.trim()) || !formData.courseId) {
      setMessage('请填写姓名、正确的11位手机号并选择线下课程');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const result = await enrollCourse({
        name: formData.name,
        phone: formData.phone,
        courseId: formData.courseId,
        channel: 'website',
      });

      if (result.success) {
        setMessage(result.message || '咨询报名已提交，我们会尽快与您联系。');
        setFormData(current => ({ ...current, name: '', phone: '' }));
      } else {
        setMessage(result.error || '提交失败，请稍后重试');
      }
    } catch (error) {
      setMessage('提交失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white py-12">
      <div className="container mx-auto px-4 max-w-2xl">
        <h1 className="text-3xl font-bold text-center mb-8 text-pink-600">
          免费咨询报名
        </h1>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-lg p-8">
          {/* 手机号（第一位） */}
          <div className="mb-6">
            <label className="block text-gray-700 font-medium mb-2">
              手机号 <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
              placeholder="请输入您的11位手机号"
              maxLength={11}
              required
            />
            <p className="mt-1 text-sm text-gray-500">手机号是唯一识别码，已注册学员会自动关联</p>
          </div>

          {/* 姓名（第二位） */}
          <div className="mb-6">
            <label className="block text-gray-700 font-medium mb-2">
              姓名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
              placeholder="请输入您的姓名"
              required
            />
            <p className="mt-1 text-sm text-gray-500">如果您是老学员，姓名可能会被更新</p>
          </div>

          {/* 咨询项目 */}
          <div className="mb-6">
            <label className="block text-gray-700 font-medium mb-2">
              选择线下课程 <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.courseId}
              onChange={(event) => setFormData({ ...formData, courseId: event.target.value })}
              disabled={coursesLoading || courses.length === 0}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
              required
            >
              <option value="">
                {coursesLoading ? '正在加载线下课程...' : courses.length ? '请选择线下课程' : '暂无可报名的线下课程'}
              </option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}{course.startDate ? ` · ${course.startDate}` : ''}
                </option>
              ))}
            </select>
            <p className="mt-1 text-sm text-gray-500">课程列表实时同步自伊娃东方舞数字化平台</p>
          </div>

          {message && (
            <div className={`mb-6 p-4 rounded-lg ${
              /成功|已提交/.test(message) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-pink-600 text-white py-4 rounded-lg font-medium hover:bg-pink-700 transition-colors disabled:opacity-50"
          >
            {loading ? '提交中...' : '免费咨询报名'}
          </button>

          <p className="mt-4 text-center text-gray-500 text-sm">
            提交后，管理员和老师将收到站内消息，并尽快与您联系
          </p>
        </form>
      </div>
    </div>
  );
}
