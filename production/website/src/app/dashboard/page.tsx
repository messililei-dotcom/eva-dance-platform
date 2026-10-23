'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { clearStudentSession, getStudentSession } from '@/lib/student-auth';

interface StudentInfo {
  id: number;
  name: string;
  phone: string;
  level: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const session = getStudentSession();

    if (!session) {
      router.push('/?login=1&next=%2Fdashboard');
      return;
    }

    // 获取统一学员档案
    fetch('/api/student/profile', {
      headers: { 'Authorization': `Bearer ${session.token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.id) {
          setStudent(data);
        } else {
          router.replace('/?login=1&next=%2Fdashboard');
        }
      })
      .catch(() => router.replace('/?login=1&next=%2Fdashboard'))
      .finally(() => setLoading(false));
  }, [router]);

  const handleLogout = () => {
    clearStudentSession();
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-warm-white flex items-center justify-center">
        <div className="text-text-secondary">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-warm-white">
      {/* Header */}
      <header className="bg-crimson text-white py-6 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gold rounded-full flex items-center justify-center text-xl font-bold">
              舞
            </div>
            <div>
              <h1 className="text-xl font-bold">学员中心</h1>
              <p className="text-white/70">{student?.name} · {student?.level || '学员'}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="bg-white/20 px-4 py-2 rounded-lg hover:bg-white/30 transition-colors"
          >
            退出登录
          </button>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-100 py-4 px-4">
        <div className="max-w-7xl mx-auto flex gap-6">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'overview' ? 'bg-gold text-white' : 'text-text-secondary hover:text-text'}`}
          >
            总览
          </button>
          <Link
            href="/dashboard/courses"
            className="px-4 py-2 rounded-lg font-medium text-text-secondary hover:text-text transition-colors"
          >
            我的课程
          </Link>
          <Link
            href="/dashboard/progress"
            className="px-4 py-2 rounded-lg font-medium text-text-secondary hover:text-text transition-colors"
          >
            学习进度
          </Link>
          <Link
            href="/dashboard/certificates"
            className="px-4 py-2 rounded-lg font-medium text-text-secondary hover:text-text transition-colors"
          >
            结业证书
          </Link>
          <Link
            href="/dashboard/profile"
            className="px-4 py-2 rounded-lg font-medium text-text-secondary hover:text-text transition-colors"
          >
            个人信息
          </Link>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto py-8 px-4">
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="text-gold text-sm font-medium mb-2">已购课程</div>
                <div className="text-3xl font-bold text-text">3</div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="text-gold text-sm font-medium mb-2">累计课次</div>
                <div className="text-3xl font-bold text-text">68</div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="text-gold text-sm font-medium mb-2">已学课次</div>
                <div className="text-3xl font-bold text-text">45</div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="text-gold text-sm font-medium mb-2">结业证书</div>
                <div className="text-3xl font-bold text-text">1</div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-bold text-text mb-4">快速入口</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link href="/courses" className="bg-gold/10 p-4 rounded-lg hover:bg-gold/20 transition-colors">
                  <div className="text-gold font-medium">浏览课程</div>
                  <div className="text-text-secondary text-sm mt-1">发现更多精彩课程</div>
                </Link>
                <Link href="/dashboard/progress" className="bg-gold/10 p-4 rounded-lg hover:bg-gold/20 transition-colors">
                  <div className="text-gold font-medium">学习进度</div>
                  <div className="text-text-secondary text-sm mt-1">查看课次核销记录</div>
                </Link>
                <Link href="/contact" className="bg-gold/10 p-4 rounded-lg hover:bg-gold/20 transition-colors">
                  <div className="text-gold font-medium">联系客服</div>
                  <div className="text-text-secondary text-sm mt-1">有任何问题请联系</div>
                </Link>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-bold text-text mb-4">最近活动</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-text">报名了「国际技巧超魔班(SWOD)」</span>
                  <span className="text-text-secondary text-sm">2024-01-20</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-text">核销了3课次</span>
                  <span className="text-text-secondary text-sm">2024-02-05</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
