'use client';
import { useState, useEffect } from 'react';
import { Alert, App, Input, Button, Checkbox, Typography } from 'antd';
import { UserOutlined, LockOutlined, EyeInvisibleOutlined, EyeTwoTone } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { authApi } from '@/lib/api';
import { apiErrorMessage, isRecord } from '@/lib/data-shape';

const { Title, Text } = Typography;

const REMEMBER_USER_KEY = 'remembered_username';

function mobileHomePath() {
  if (typeof window === 'undefined') return '/dashboard';
  return window.matchMedia('(max-width: 767px)').matches ? '/online-course/auth' : '/dashboard';
}

export default function LoginPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [rememberAccount, setRememberAccount] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // 加载记住的账号
  useEffect(() => {
    const saved = localStorage.getItem(REMEMBER_USER_KEY);
    if (saved) {
      try {
        const { username } = JSON.parse(saved);
        setUsername(username || '');
        setRememberAccount(true);
      } catch {}
    }

    // SSO: 从URL参数检测token，自动登录
    const params = new URLSearchParams(window.location.search);
    const ssoToken = params.get('ssoToken');
    if (ssoToken) {
      setLoading(true);
      setLoginError('');
      // 先仅存储admin_token用于验证，不写入userData
      localStorage.setItem('admin_token', ssoToken);
      localStorage.setItem('token', ssoToken);
      authApi.ensureMediaAuthCookie();
      // 验证token有效性，验证成功后才存储用户信息
      authApi.validateToken().then(result => {
        const user = result.user || { username: '管理员', name: '管理员', role: 'admin' };
        localStorage.setItem('admin_user', JSON.stringify(user));
        localStorage.setItem('userData', JSON.stringify(user));
        message.success('登录成功');
        router.push(mobileHomePath());
      }).catch(() => {
        // 验证失败则清除所有已存储的token
        localStorage.removeItem('admin_token');
        localStorage.removeItem('token');
        setLoading(false);
        setLoginError('令牌已过期，请重新登录');
        message.warning('令牌已过期，请重新登录');
      });
    }
  }, [router]);

  // 详细的错误消息映射
  const getErrorMessage = (err: unknown): string => {
    if (!err) return '登录失败，请重试';

    const response = isRecord(err) && isRecord(err.response) ? err.response : undefined;
    const status = response?.status;
    const serverMsg = apiErrorMessage(err, '');

    if (serverMsg) return serverMsg;

    switch (status) {
      case 401: return '账号或密码错误，请重新输入';
      case 403: return '账号已被停用，请联系管理员';
      case 404: return '登录服务暂不可用';
      case 429: return '登录尝试过于频繁，请稍后再试';
      case 500: return '服务器内部错误，请稍后重试';
      case 502:
      case 503: return '服务暂时不可用，请稍后重试';
    }

    const messageText = isRecord(err) && typeof err.message === 'string' ? err.message : '';
    if (messageText.includes('Network Error') || messageText.includes('timeout')) {
      return '网络连接异常，请检查网络后重试';
    }

    return messageText || '登录失败，请重试';
  };

  const handleLogin = async () => {
    const loginUsername = username.trim();

    if (!loginUsername) {
      setLoginError('请输入账号');
      message.warning('请输入账号');
      return;
    }
    if (!password || password.length < 4) {
      setLoginError('请输入正确密码（至少4位）');
      message.warning('请输入正确密码（至少4位）');
      return;
    }

    setLoading(true);
    setLoginError('');
    try {
      await authApi.login(loginUsername, password);

      if (rememberAccount) {
        localStorage.setItem(REMEMBER_USER_KEY, JSON.stringify({ username: loginUsername }));
      } else {
        localStorage.removeItem(REMEMBER_USER_KEY);
      }

      message.success({
        content: '登录成功，欢迎回来！',
        duration: 2,
      });
      window.location.href = mobileHomePath();
    } catch (err: unknown) {
      const errMsg = getErrorMessage(err);
      setLoginError(errMsg);
      message.error({
        content: errMsg,
        duration: 4,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page" style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 24px',
      boxSizing: 'border-box',
      background: '#FFFFFF',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div className="login-shell" style={{
        width: '100%',
        maxWidth: 1040,
        display: 'grid',
        gridTemplateColumns: 'minmax(360px, 1fr) 380px',
        gap: 72,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        zIndex: 1,
      }}>
      {/* Left: Brand Side */}
      <div className="login-brand-panel" style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minWidth: 0,
        padding: 0,
        position: 'relative',
        zIndex: 1,
      }}>
        <div style={{ textAlign: 'center', maxWidth: 520 }}>
          <div className="login-feature-grid" style={{
            width: 88,
            height: 88,
            borderRadius: 24,
            background: 'linear-gradient(135deg, #F72A8A, #7C3AED)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
            boxShadow: '0 20px 40px rgba(247,42,138,0.22)',
            color: '#fff',
            fontSize: 40,
            fontWeight: 800,
          }}>
            E
          </div>
          <Title className="login-brand-title" level={1} style={{ color: '#121A3A', marginBottom: 8, fontSize: 36 }}>
            伊娃东方舞
          </Title>
          <Title className="login-brand-subtitle" level={4} style={{
            color: '#F72A8A',
            fontWeight: 600,
            margin: '0 0 8px',
            fontSize: 16,
            letterSpacing: 2,
          }}>
            数字化运营平台
          </Title>
          <Text style={{ color: '#606A80', fontSize: 16 }}>
            连接 · 学习 · 成长 · 绽放
          </Text>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2,1fr)',
            gap: 12,
            marginTop: 40,
          }}>
            {[
              ['🎯', '一体化管理', '全业务场景覆盖'],
              ['📊', '数据联动', '实时数据洞察'],
              ['🔒', '安全稳定', '企业级安全保障'],
              ['⚡', '高效便捷', '智能工作流'],
            ].map(([icon, t, d], i) => (
              <div key={i} style={{
                background: '#FFFFFF',
                borderRadius: 12,
                padding: '14px 18px',
                border: '1px solid #E9ECF5',
                boxShadow: '0 12px 32px rgba(18, 26, 58, 0.08)',
                transition: 'all 0.3s',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = '#FFF4FA'; e.currentTarget.style.borderColor = '#FFB6D8'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.borderColor = '#E9ECF5'; }}
              >
                <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
                <Text strong style={{ color: '#121A3A', display: 'block', marginBottom: 2, fontSize: 13 }}>{t}</Text>
                <Text style={{ color: '#7A8199', fontSize: 11 }}>{d}</Text>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Login Form */}
      <div className="login-form-panel" style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        position: 'relative',
        zIndex: 1,
      }}>
        <div className="login-card" style={{
          width: '100%',
          maxWidth: 380,
          background: '#fff',
          borderRadius: 20,
          padding: 40,
          border: '1px solid #E9ECF5',
          boxShadow: '0 24px 64px rgba(18, 26, 58, 0.14)',
        }}>
          <div className="login-card-heading" style={{ textAlign: 'center', marginBottom: 32 }}>
            <div className="login-card-brand-title">
              <span className="login-card-logo">
                <Image src="/apple-touch-icon-20261005.png" alt="伊娃东方舞" width={44} height={44} priority />
              </span>
              <Title level={3} style={{ margin: 0, color: '#121A3A' }}>伊娃东方舞</Title>
            </div>
            <Text className="login-card-subtitle" style={{ color: '#6b7280', fontSize: 14 }}>数字化平台</Text>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} style={{ width: '100%' }}>
            {loginError && (
              <Alert
                type="error"
                showIcon
                message={loginError}
                style={{
                  marginBottom: 20,
                  borderRadius: 10,
                  borderColor: '#FCA5A5',
                  background: '#FEF2F2',
                  color: '#991B1B',
                  fontSize: 14,
                  fontWeight: 600,
                  boxShadow: '0 10px 24px rgba(220, 38, 38, 0.12)',
                }}
              />
            )}

            <div style={{ marginBottom: 24 }}>
              <Input
                id="login-username"
                prefix={<UserOutlined style={{ color: '#999' }} />}
                placeholder="账号"
                size="large"
                value={username}
                status={loginError ? 'error' : undefined}
                onChange={event => {
                  setUsername(event.target.value);
                  if (loginError) setLoginError('');
                }}
                style={{ borderRadius: 10, height: 48, paddingLeft: 14 }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <Input.Password
                id="login-password"
                prefix={<LockOutlined style={{ color: '#999' }} />}
                placeholder="密码"
                size="large"
                value={password}
                status={loginError ? 'error' : undefined}
                onChange={event => {
                  setPassword(event.target.value);
                  if (loginError) setLoginError('');
                }}
                iconRender={visible => visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />}
                style={{ borderRadius: 10, height: 48, paddingLeft: 14 }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <Checkbox
                id="login-remember"
                checked={rememberAccount}
                onChange={e => setRememberAccount(e.target.checked)}
                style={{ fontSize: 13, color: '#6b7280' }}
              >
                记住账号
              </Checkbox>
              <a href="/forgot-password" style={{ fontSize: 13, color: '#F72A8A' }}>忘记密码？</a>
            </div>

            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              size="large"
              style={{
                height: 48,
                borderRadius: 10,
                fontSize: 16,
                fontWeight: 600,
                background: 'linear-gradient(135deg, #F72A8A, #7C3AED)',
                border: 'none',
                boxShadow: '0 12px 28px rgba(247,42,138,0.24)',
                letterSpacing: 4,
              }}
            >
              {loading ? '登录中...' : '登  录'}
            </Button>
          </form>

          <div style={{
            marginTop: 24,
            paddingTop: 20,
            borderTop: '1px solid #f0f0f0',
            textAlign: 'center',
          }}>
            <Text style={{ color: '#999', fontSize: 12 }}>
              伊娃东方舞 © {new Date().getFullYear()} 版权所有
            </Text>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
