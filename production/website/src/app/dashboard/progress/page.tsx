'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getStudentSession } from '@/lib/student-auth';

interface ConsumeRecord {
  id: number;
  courseName: string;
  count: number;
  consumeDate: string;
  remainingAfter: number;
}

export default function ProgressPage() {
  const router = useRouter();
  const [records, setRecords] = useState<ConsumeRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = getStudentSession();

    if (!session) {
      router.push('/?login=1&next=%2Fdashboard%2Fprogress');
      return;
    }

    fetch(`/api/consume-records?memberId=${session.id}`, {
      headers: { 'Authorization': `Bearer ${session.token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setRecords(data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return <div className="min-h-screen bg-warm-white flex items-center justify-center">加载中...</div>;
  }

  const totalConsumed = records.reduce((sum, r) => sum + r.count, 0);

  return (
    <div className="min-h-screen bg-warm-white py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-text mb-6">学习进度</h1>
        
        {/* Stats */}
        <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-gold text-sm font-medium">累计学习课次</div>
              <div className="text-3xl font-bold text-text mt-2">{totalConsumed}</div>
            </div>
            <div>
              <div className="text-gold text-sm font-medium">核销记录</div>
              <div className="text-3xl font-bold text-text mt-2">{records.length}</div>
            </div>
          </div>
        </div>

        {/* Records */}
        {records.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center">
            <p className="text-text-secondary">暂无学习记录</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-sand/30">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-text">课程</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-text">核销课次</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-text">日期</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-text">剩余课次</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {records.map((record) => (
                  <tr key={record.id}>
                    <td className="px-6 py-4 text-text">{record.courseName}</td>
                    <td className="px-6 py-4 text-gold font-bold">{record.count}</td>
                    <td className="px-6 py-4 text-text-secondary">{record.consumeDate}</td>
                    <td className="px-6 py-4 text-text">{record.remainingAfter}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
