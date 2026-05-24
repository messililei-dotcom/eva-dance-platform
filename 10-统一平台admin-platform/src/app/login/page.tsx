'use client';
import { useState, useEffect } from 'react';
import { Form, Input, Button, Checkbox, message, Typography } from 'antd';
import { UserOutlined, LockOutlined, EyeInvisibleOutlined, EyeTwoTone } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';

const { Title, Text } = Typography;

const REMEMBER_USER_KEY = 'remembered_username';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [rememberPassword, setRememberPassword] = useState(false);

  // 加载记住的账号
  useEffect(() => {
    const saved = localStorage.getItem(REMEMBER_USER_KEY);
    if (saved) {
      try {
        const { username, password } = JSON.parse(saved);
        form.setFieldsValue({ username, password, remember: true });
        setRememberPassword(true);
      } catch {}
    }

    // SSO: 从URL参数检测token，自动登录
    const params = new URLSearchParams(window.location.search);
    const ssoToken = params.get('ssoToken');
    if (ssoToken) {
      setLoading(true);
      localStorage.setItem('admin_token', ssoToken);
      localStorage.setItem('admin_user', JSON.stringify({ username: '管理员', name: '管理员', role: 'admin' }));
      // 验证token有效性
      fetch('/api/validate-token', {
        headers: { 'Authorization': `Bearer ${ssoToken}` }
      }).then(res => {
        if (res.ok) {
          message.success('🎉 登录成功！');
          router.push('/dashboard');
        } else {
          localStorage.removeItem('admin_token');
          localStorage.removeItem('admin_user');
          setLoading(false);
          message.warning('令牌已过期，请重新登录');
        }
      }).catch(() => {
        setLoading(false);
      });
    }
  }, [form, router]);

  // 详细的错误消息映射
  const getErrorMessage = (err: any): string => {
    if (!err) return '登录失败，请重试';

    const status = err?.response?.status;
    const serverMsg = err?.response?.data?.error || err?.response?.data?.message;

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

    if (err?.message?.includes('Network Error') || err?.message?.includes('timeout')) {
      return '网络连接异常，请检查网络后重试';
    }

    return err?.message || '登录失败，请重试';
  };

  const onFinish = async (v: { username: string; password: string; remember?: boolean }) => {
    setLoading(true);
    try {
      await authApi.login(v.username, v.password);

      // 记住密码
      if (v.remember) {
        localStorage.setItem(REMEMBER_USER_KEY, JSON.stringify({ username: v.username, password: v.password }));
      } else {
        localStorage.removeItem(REMEMBER_USER_KEY);
      }

      message.success({
        content: '🎉 登录成功，欢迎回来！',
        duration: 2,
      });
      router.push('/dashboard');
    } catch (err: any) {
      const errMsg = getErrorMessage(err);
      message.error({
        content: errMsg,
        duration: 4,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      background: 'linear-gradient(135deg, #FFF1F8 0%, #F6E9FF 46%, #EEF5FF 100%)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* 背景装饰 */}
      <div style={{
        position: 'absolute',
        top: -100,
        right: -100,
        width: 400,
        height: 400,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(247,42,138,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        bottom: -80,
        left: -80,
        width: 300,
        height: 300,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139,26,26,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Left: Brand Side */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 48,
        position: 'relative',
        zIndex: 1,
      }}>
        <div style={{ textAlign: 'center', maxWidth: 500 }}>
          <div style={{
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
          <Title level={1} style={{ color: '#fff', marginBottom: 8, fontSize: 36 }}>
            伊娃东方舞
          </Title>
          <Title level={4} style={{
            color: 'rgba(247,42,138,0.82)',
            fontWeight: 400,
            margin: '0 0 8px',
            fontSize: 16,
            letterSpacing: 4,
          }}>
            数字化运营平台
          </Title>
          <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 16 }}>
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
                background: 'rgba(255,255,255,0.06)',
                borderRadius: 12,
                padding: '14px 18px',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.06)',
                transition: 'all 0.3s',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(247,42,138,0.1)'; e.currentTarget.style.borderColor = 'rgba(247,42,138,0.22)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
              >
                <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
                <Text strong style={{ color: '#fff', display: 'block', marginBottom: 2, fontSize: 13 }}>{t}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>{d}</Text>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Login Form */}
      <div style={{
        width: 480,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 48,
        position: 'relative',
        zIndex: 1,
      }}>
        <div style={{
          width: '100%',
          maxWidth: 380,
          background: '#fff',
          borderRadius: 20,
          padding: 40,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <Title level={3} style={{ marginBottom: 4, color: '#1f2937' }}>欢迎回来</Title>
            <Text style={{ color: '#6b7280', fontSize: 14 }}>登录您的管理后台</Text>
          </div>

          <Form
            form={form}
            name="login"
            onFinish={onFinish}
            size="large"
            initialValues={{ remember: false }}
          >
            <Form.Item
              name="username"
              rules={[
                { required: true, message: '请输入账号或手机号' },
                { min: 2, message: '账号至少2个字符' },
              ]}
            >
              <Input
                prefix={<UserOutlined style={{ color: '#999' }} />}
                placeholder="账号 / 手机号"
                style={{ borderRadius: 10, height: 48, paddingLeft: 14 }}
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 4, message: '密码至少4个字符' },
              ]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#999' }} />}
                placeholder="密码"
                iconRender={visible => visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />}
                style={{ borderRadius: 10, height: 48, paddingLeft: 14 }}
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Form.Item name="remember" valuePropName="checked" noStyle>
                  <Checkbox
                    checked={rememberPassword}
                    onChange={e => setRememberPassword(e.target.checked)}
                    style={{ fontSize: 13, color: '#6b7280' }}
                  >
                    记住密码
                  </Checkbox>
                </Form.Item>
                <a style={{ fontSize: 13, color: '#F72A8A' }}>忘记密码？</a>
              </div>
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
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
            </Form.Item>
          </Form>

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
  );
}
