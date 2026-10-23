'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const sendCode = async () => {
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setError('请输入正确的手机号');
      return;
    }

    setSendingCode(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();

      if (!res.ok || data.success === false) {
        setError(data.error || '验证码发送失败');
        return;
      }

      setSuccess(data.code ? `验证码：${data.code}` : '验证码已发送，请查收短信');
    } catch (err) {
      setError('网络错误，请稍后重试');
    } finally {
      setSendingCode(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/student-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      });

      const data = await res.json();

      if (!res.ok || !data.token) {
        setError(data.error || '注册失败，请稍后重试');
        return;
      }

      await fetch('/api/student/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${data.token}`,
        },
        body: JSON.stringify({ name }),
      });

      localStorage.setItem('studentToken', data.token);
      localStorage.setItem('studentId', data.user?.id || '');
      localStorage.setItem('studentName', name || data.user?.name || '');
      setSuccess('资料已保存，正在进入学员中心');
      setTimeout(() => router.push('/dashboard'), 800);
    } catch (err) {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-crimson-dark via-crimson to-gold-dark flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gold rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
            舞
          </div>
          <h1 className="text-2xl font-serif font-bold text-text">完善学员资料</h1>
          <p className="text-text-secondary mt-2">手机号会同步到官网、学员系统和网课授权</p>
        </div>

        {/* Form */}
        <form onSubmit={handleRegister} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-text mb-2">姓名</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="请输入您的姓名"
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/50"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-2">手机号</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="请输入手机号（作为登录账号）"
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/50"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-2">验证码</label>
            <div className="flex gap-3">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="请输入验证码"
                className="min-w-0 flex-1 px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/50"
                required
              />
              <button
                type="button"
                onClick={sendCode}
                disabled={sendingCode}
                className="shrink-0 px-4 py-3 border border-gold text-gold rounded-lg font-medium hover:bg-gold/10 transition-colors disabled:opacity-50"
              >
                {sendingCode ? '发送中' : '获取验证码'}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 text-green-600 px-4 py-3 rounded-lg text-sm">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gold text-white py-3 rounded-lg font-medium hover:bg-gold-dark transition-colors disabled:opacity-50"
          >
            {loading ? '保存中...' : '保存并登录'}
          </button>
        </form>

        {/* Links */}
        <div className="mt-6 text-center space-y-2">
          <p className="text-text-secondary">
            已有账号？{' '}
            <Link href="/login" className="text-gold hover:underline">
              立即登录
            </Link>
          </p>
          <Link href="/" className="text-text-secondary hover:text-gold">
            返回首页
          </Link>
        </div>
      </div>
    </div>
  );
}
