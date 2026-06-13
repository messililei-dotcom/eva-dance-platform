'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Checkbox, Form, Input, Typography, message } from 'antd';
import { LockOutlined, MobileOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { studentApi } from '@/lib/student-api';

const { Text, Title } = Typography;

const PHONE_PATTERN = /^1[3-9]\d{9}$/;
const REMEMBER_PHONE_KEY = 'student_remember_phone';
const BRAND = {
  gold: '#C8A96E',
  goldDark: '#A98746',
  red: '#8B1A1A',
  bg: '#F7F3EB',
  text: '#2C1810',
  muted: '#8C8172',
  border: '#E8DDCB',
  card: '#FFFDF8',
  shadow: '0 2px 8px rgba(44,24,16,0.06)',
};

export default function StudentLoginPage() {
  const router = useRouter();
  const [form] = Form.useForm<{ phone: string; code: string; remember: boolean }>();
  const [sending, setSending] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [devCode, setDevCode] = useState('');

  useEffect(() => {
    const token = studentApi.getToken();
    const member = studentApi.getStoredMember();
    if (token && member?.id) {
      router.replace('/learn#courses');
      return;
    }

    const savedPhone = localStorage.getItem(REMEMBER_PHONE_KEY);
    if (savedPhone) {
      form.setFieldsValue({ phone: savedPhone, remember: true });
    }
  }, [form, router]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setTimeout(() => setCountdown(value => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  const canSendCode = useMemo(() => countdown <= 0 && !sending, [countdown, sending]);

  const sendCode = async () => {
    const phone = form.getFieldValue('phone')?.trim();
    if (!PHONE_PATTERN.test(phone)) {
      message.warning('请输入正确的中国大陆手机号');
      return;
    }

    setSending(true);
    setDevCode('');
    try {
      const result = await studentApi.sendCode(phone);
      setCountdown(60);
      if (result?.devCode) {
        form.setFieldValue('code', result.devCode);
        setDevCode(result.devCode);
        message.success('本地预览验证码已自动填入');
      } else {
        message.success(result?.message || '验证码已发送');
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : '验证码发送失败');
    } finally {
      setSending(false);
    }
  };

  const handleLogin = async (values: { phone: string; code: string; remember: boolean }) => {
    setLoggingIn(true);
    try {
      await studentApi.login(values.phone.trim(), values.code.trim());
      if (values.remember) {
        localStorage.setItem(REMEMBER_PHONE_KEY, values.phone.trim());
      } else {
        localStorage.removeItem(REMEMBER_PHONE_KEY);
      }
      message.success('登录成功');
      router.replace('/learn#courses');
    } catch (err) {
      message.error(err instanceof Error ? err.message : '登录失败，请重试');
    } finally {
      setLoggingIn(false);
    }
  };

  return (
    <div className="student-login-page" style={{
      minHeight: '100vh',
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) 460px',
      background: BRAND.bg,
      color: BRAND.text,
    }}>
      <section className="student-login-hero" style={{
        position: 'relative',
        overflow: 'hidden',
        padding: 72,
        display: 'flex',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #2C1810 0%, #5A2B22 54%, #8B1A1A 100%)',
      }}>
        <div className="student-login-hero-overlay" style={{ position: 'absolute', inset: 0, zIndex: 1, background: 'linear-gradient(90deg, rgba(44,24,16,.82), rgba(44,24,16,.50) 52%, rgba(139,26,26,.22))' }} />
        <div style={{ position: 'absolute', inset: 'auto 72px 58px', zIndex: 1, height: 1, background: 'linear-gradient(90deg, rgba(200,169,110,.9), rgba(255,253,248,.18), transparent)' }} />
        <div className="student-login-hero-content" style={{ position: 'relative', zIndex: 1, maxWidth: 620, color: '#fff' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, marginBottom: 26 }}>
            <div style={{ width: 58, height: 58, borderRadius: 8, background: `linear-gradient(135deg,${BRAND.gold},${BRAND.red})`, display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: 28, boxShadow: '0 18px 34px rgba(0,0,0,.24)' }}>E</div>
            <div>
              <div style={{ color: 'rgba(255,255,255,.92)', fontWeight: 900, fontSize: 18 }}>伊娃东方舞</div>
              <div style={{ color: 'rgba(255,255,255,.62)', fontSize: 12, letterSpacing: 1 }}>AIWA RAKS</div>
            </div>
          </div>
          <Title level={1} style={{ color: '#fff', margin: 0, fontSize: 52, lineHeight: 1.12 }}>伊娃东方舞个人中心</Title>
          <Text style={{ color: 'rgba(255,255,255,.82)', fontSize: 18, display: 'block', marginTop: 14 }}>继续课程、查看进度、管理个人资料</Text>
        </div>
      </section>

      <section className="student-login-form-panel" style={{
        background: BRAND.card,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 42,
        boxShadow: '-18px 0 44px rgba(44,24,16,.08)',
        position: 'relative',
        zIndex: 2,
      }}>
        <div className="student-login-card" style={{ width: '100%', maxWidth: 376, border: `1px solid ${BRAND.border}`, borderRadius: 8, padding: 28, background: 'rgba(255,253,248,.86)', boxShadow: '0 18px 45px rgba(44,24,16,.09)' }}>
          <div className="student-login-heading" style={{ marginBottom: 30 }}>
            <Title level={2} style={{ marginBottom: 8, color: BRAND.text }}>学员登录</Title>
            <Text style={{ color: BRAND.muted }}>使用报名手机号接收验证码</Text>
          </div>

          <Form
            form={form}
            layout="vertical"
            initialValues={{ remember: true }}
            onFinish={handleLogin}
            requiredMark={false}
          >
            <Form.Item
              name="phone"
              label="手机号"
              validateFirst
              rules={[
                { required: true, message: '请输入手机号' },
                { pattern: PHONE_PATTERN, message: '请输入正确的中国大陆手机号' },
              ]}
            >
              <Input
                size="large"
                maxLength={11}
                prefix={<MobileOutlined style={{ color: BRAND.muted }} />}
                placeholder="请输入手机号"
                inputMode="tel"
              />
            </Form.Item>

            <Form.Item
              name="code"
              label="验证码"
              rules={[
                { required: true, message: '请输入验证码' },
                { pattern: /^\d{6}$/, message: '验证码为 6 位数字' },
              ]}
            >
              <Input
                size="large"
                maxLength={6}
                prefix={<LockOutlined style={{ color: BRAND.muted }} />}
                placeholder="请输入 6 位验证码"
                inputMode="numeric"
                suffix={
                  <Button type="link" disabled={!canSendCode} loading={sending} onClick={sendCode} style={{ paddingInline: 0, fontWeight: 800, color: canSendCode ? BRAND.goldDark : BRAND.muted }}>
                    {countdown > 0 ? `${countdown}s` : '获取验证码'}
                  </Button>
                }
              />
            </Form.Item>
            {devCode ? (
              <Text style={{ display: 'block', marginTop: -14, marginBottom: 18, color: BRAND.goldDark, fontWeight: 700 }}>
                本地预览验证码：{devCode}
              </Text>
            ) : null}

            <Form.Item name="remember" valuePropName="checked" style={{ marginBottom: 24 }}>
              <Checkbox>记住手机号和登录状态</Checkbox>
            </Form.Item>

            <Button type="primary" htmlType="submit" size="large" block loading={loggingIn} style={{ height: 46, borderRadius: 4, fontWeight: 800 }}>
              登录
            </Button>
          </Form>
        </div>
      </section>
    </div>
  );
}
