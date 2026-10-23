'use client';

import Image from 'next/image';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { preferredStudentName, saveStudentSession } from '@/lib/student-auth';
import { studentApi } from '@/lib/student-api';
import { SmsSendGuard, smsRetryAfterSeconds, smsSendErrorMessage } from '@/lib/sms-verification';
import { chooseWechatLogin, isStandalonePwa, pwaLoginSuccessPath } from '@/lib/pwa-auth-flow';

type StudentLoginModalProps = {
  open: boolean;
  forcePhone?: boolean;
  onClose: () => void;
  onSuccess?: (name: string) => void;
  nextPath?: string;
};

const COUNTRY_CODES = [
  { label: '中国', code: '+86' },
  { label: '中国香港', code: '+852' },
  { label: '中国澳门', code: '+853' },
  { label: '中国台湾', code: '+886' },
  { label: '美国/加拿大', code: '+1' },
  { label: '英国', code: '+44' },
  { label: '澳大利亚', code: '+61' },
  { label: '新加坡', code: '+65' },
  { label: '马来西亚', code: '+60' },
  { label: '日本', code: '+81' },
  { label: '韩国', code: '+82' },
  { label: '泰国', code: '+66' },
  { label: '法国', code: '+33' },
  { label: '德国', code: '+49' },
];

const QR_LOGIN_ENABLED = process.env.NEXT_PUBLIC_WECHAT_QR_ENABLED === 'true';
const MINIAPP_HANDOFF_ENABLED = process.env.NEXT_PUBLIC_WECHAT_MINIAPP_HANDOFF_ENABLED === 'true';

function normalizeLocalPhoneInput(value: string, countryCode: string) {
  if (value.trim().startsWith('+')) return value.replace(/[^\d+]/g, '').slice(0, 16);
  const maxLength = countryCode === '+86' ? 11 : 14;
  return value.replace(/\D/g, '').slice(0, maxLength);
}

function isValidLocalPhone(phone: string, countryCode: string) {
  const digits = phone.replace(/\D/g, '');
  if (phone.trim().startsWith('+')) return /^\+\d{6,15}$/.test(phone);
  if (countryCode === '+86') return /^1[3-9]\d{9}$/.test(digits);
  return digits.length >= 4 && digits.length <= 14;
}

export default function StudentLoginModal({ open, onClose, onSuccess, nextPath, forcePhone = false }: StudentLoginModalProps) {
  const [countryCode, setCountryCode] = useState('+86');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [phoneOnlyPwa, setPhoneOnlyPwa] = useState(() => (
    forcePhone || (typeof window !== 'undefined'
    && isStandalonePwa()
    && !window.matchMedia('(min-width: 768px)').matches)
  ));
  const [wechatLabel, setWechatLabel] = useState('微信一键登录');
  const [wechatPending, setWechatPending] = useState(false);
  const [wechatAuthorizeUrl, setWechatAuthorizeUrl] = useState('');
  const sendGuardRef = useRef(new SmsSendGuard());
  const handoffTimerRef = useRef<number | null>(null);
  const handoffPollingRef = useRef(false);
  const wechatWindowRef = useRef<Window | null>(null);

  const stopWechatHandoff = () => {
    if (handoffTimerRef.current !== null) window.clearInterval(handoffTimerRef.current);
    handoffTimerRef.current = null;
    handoffPollingRef.current = false;
  };

  useEffect(() => {
    if (!open) return;
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => undefined);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    const isDesktop = window.matchMedia('(min-width: 768px)').matches;
    const standalone = isStandalonePwa();
    setPhoneOnlyPwa(forcePhone || (standalone && !isDesktop));
    setWechatLabel(chooseWechatLogin({
      userAgent: window.navigator.userAgent,
      isDesktop,
      qrEnabled: QR_LOGIN_ENABLED,
      isStandalonePwa: standalone,
      miniAppEnabled: MINIAPP_HANDOFF_ENABLED,
    }).label);

    return () => {
      stopWechatHandoff();
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setCooldownSeconds(sendGuardRef.current.remainingSeconds());
    }, 250);
    return () => window.clearInterval(timer);
  }, [cooldownSeconds]);

  const resetMessage = () => {
    setError('');
    setNotice('');
  };

  const sendCode = async () => {
    if (!isValidLocalPhone(phone, countryCode)) {
      setError('请输入正确的手机号');
      return;
    }
    if (!sendGuardRef.current.tryStart()) {
      const remaining = sendGuardRef.current.remainingSeconds();
      if (remaining > 0) setError(`操作过于频繁，请 ${remaining} 秒后重试`);
      return;
    }

    setSendingCode(true);
    resetMessage();

    try {
      const result = await studentApi.sendCode(phone, countryCode);
      sendGuardRef.current.succeed();
      setCooldownSeconds(sendGuardRef.current.remainingSeconds());
      const devCode = result?.devCode || result?.code;
      if (devCode) setCode(String(devCode));
      setNotice(devCode
        ? `验证码：${devCode}（5 分钟内有效）`
        : `${result?.message || '验证码已发送，请查收短信'}，5 分钟内有效`);
    } catch (err) {
      const retryAfter = smsRetryAfterSeconds(err);
      if (retryAfter > 0) {
        sendGuardRef.current.cooldown(retryAfter);
        setCooldownSeconds(sendGuardRef.current.remainingSeconds());
      } else {
        sendGuardRef.current.fail();
      }
      setError(smsSendErrorMessage(err));
    } finally {
      setSendingCode(false);
    }
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    resetMessage();

    try {
      const syncedMember = await studentApi.login(phone, code, countryCode);
      const token = studentApi.getToken();
      if (!token) throw new Error('登录成功但未返回令牌');
      const name = preferredStudentName(syncedMember);
      saveStudentSession({ token, id: syncedMember.id || '', name });
      setCode('');
      setNotice('');
      onSuccess?.(name);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请检查手机号和验证码');
    } finally {
      setLoading(false);
    }
  };

  const handleWechatLogin = async () => {
    resetMessage();
    const isDesktop = window.matchMedia('(min-width: 768px)').matches;
    const standalone = isStandalonePwa();
    if (standalone && !isDesktop) return;
    const choice = chooseWechatLogin({
      userAgent: window.navigator.userAgent,
      isDesktop,
      qrEnabled: QR_LOGIN_ENABLED,
      isStandalonePwa: standalone,
      miniAppEnabled: MINIAPP_HANDOFF_ENABLED,
    });
    if (!choice.available) {
      setError(choice.error || '微信登录暂不可用');
      return;
    }
    const current = `${window.location.pathname}${window.location.search || ''}`;
    const next = pwaLoginSuccessPath(nextPath) || current;
    // QR authorization must stay in a separate window. Redirecting this tab
    // replaces the page the student was viewing and makes the login modal vanish.
    // The handoff endpoint lets the original page receive the completed session.
    const usePopupHandoff = choice.mode === 'qr'
      || (choice.mode === 'mini' && !isDesktop && standalone);
    if (usePopupHandoff) {
      stopWechatHandoff();
      setWechatPending(true);
      setWechatAuthorizeUrl('');
      const authWindow = window.open(
        'about:blank',
        'eva-wechat-login',
        'popup=yes,width=520,height=680',
      );
      wechatWindowRef.current = authWindow;
      if (authWindow) {
        try {
          authWindow.document.title = '正在打开微信登录';
          authWindow.document.body.innerHTML = '<p style="padding:32px;text-align:center;font-family:sans-serif">正在打开微信登录...</p>';
          authWindow.opener = null;
        } catch {}
      }

      try {
        const startUrl = choice.mode === 'mini'
          ? `/api/wechat/mini-handoff/start?next=${encodeURIComponent(next)}`
          : `/api/wechat/oauth/start?mode=qr&handoff=1&next=${encodeURIComponent(next)}`;
        const startResponse = await fetch(startUrl, { cache: 'no-store', credentials: 'same-origin' });
        const start = await startResponse.json().catch(() => ({})) as Record<string, any>;
        const authorizeUrl = String(start.openUrl || start.authorizeUrl || '');
        if (!startResponse.ok || !start.success || !authorizeUrl || !start.handoffId || !start.pollToken) {
          throw new Error(start.message || '微信登录服务暂不可用，请稍后再试');
        }

        setWechatAuthorizeUrl(authorizeUrl);
        setNotice(authWindow
          ? (choice.mode === 'mini'
            ? '请在微信小程序中确认登录，完成后返回网课系统App。'
            : '请在打开的页面完成微信授权，完成后返回网课系统App。')
          : '请点击下方的微信登录链接，完成后返回网课系统App。');
        if (authWindow) authWindow.location.replace(authorizeUrl);

        const poll = async () => {
          if (handoffPollingRef.current) return;
          handoffPollingRef.current = true;
          try {
            const statusUrl = `/api/wechat/oauth/handoff?id=${encodeURIComponent(String(start.handoffId))}&token=${encodeURIComponent(String(start.pollToken))}`;
            const statusResponse = await fetch(statusUrl, { cache: 'no-store', credentials: 'same-origin' });
            const status = await statusResponse.json().catch(() => ({})) as Record<string, any>;
            if (statusResponse.status === 202 || status.status === 'pending') return;
            if (!statusResponse.ok || status.status !== 'completed' || !status.token || !status.member) {
              throw new Error(status.message || '微信授权未完成，请重新登录');
            }

            const name = preferredStudentName(status.member);
            saveStudentSession({ token: String(status.token), id: String(status.member.id || ''), name });
            stopWechatHandoff();
            setWechatPending(false);
            setWechatAuthorizeUrl('');
            try { wechatWindowRef.current?.close(); } catch {}
            onSuccess?.(name);
            onClose();
          } catch (err) {
            stopWechatHandoff();
            setWechatPending(false);
            setError(err instanceof Error ? err.message : '微信登录失败，请重新操作');
          } finally {
            handoffPollingRef.current = false;
          }
        };

        handoffTimerRef.current = window.setInterval(() => { void poll(); }, 1500);
        const handleVisible = () => {
          if (document.visibilityState === 'visible') {
            document.removeEventListener('visibilitychange', handleVisible);
            void poll();
          }
        };
        document.addEventListener('visibilitychange', handleVisible);
        void poll();
      } catch (err) {
        stopWechatHandoff();
        setWechatPending(false);
        try { authWindow?.close(); } catch {}
        setError(err instanceof Error ? err.message : '微信登录失败，请重新操作');
      }
      return;
    }
    window.location.assign(`/api/wechat/oauth/start?mode=${encodeURIComponent(choice.mode)}&next=${encodeURIComponent(next)}`);
  };

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[2147483647] flex items-start justify-center overflow-y-auto overscroll-contain bg-black/55 px-4 py-6 backdrop-blur-sm"
      data-history-swipe="ignore"
      role="dialog"
      aria-modal="true"
      aria-labelledby="student-login-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="relative my-auto w-full max-w-[420px] shrink-0 rounded-lg bg-white p-6 shadow-2xl md:p-7">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary transition hover:bg-sand/40 hover:text-crimson"
          aria-label="关闭登录窗口"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-lg border border-gold/20 bg-sand/30">
            <Image
              src="/logo-transparent-20261005.png"
              alt="伊娃东方舞"
              width={52}
              height={52}
              className="h-[52px] w-[52px] object-contain"
              priority
            />
          </div>
          <h2 id="student-login-title" className="font-serif text-2xl font-bold text-text">
            {phoneOnlyPwa ? '手机号登录' : '学员登录'}
          </h2>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          {!phoneOnlyPwa && (
            <>
              <button
                type="button"
                onClick={handleWechatLogin}
                disabled={wechatPending}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#1AAD19] bg-[#1AAD19] px-4 py-3 font-medium text-white transition hover:bg-[#168F16]"
              >
                {wechatPending ? '等待微信授权...' : wechatLabel}
              </button>

              {wechatPending && wechatAuthorizeUrl && (
                <a
                  href={wechatAuthorizeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-center text-sm font-medium text-[#168F16] underline underline-offset-4"
                >
                  打开微信一键登录
                </a>
              )}

              <div className="flex items-center gap-3 text-xs text-text-muted">
                <span className="h-px flex-1 bg-gray-200" />
                <span>或使用手机号验证码</span>
                <span className="h-px flex-1 bg-gray-200" />
              </div>
            </>
          )}

          <div>
            <label htmlFor="student-login-phone" className="mb-2 block text-sm font-medium text-text">手机号</label>
            <div className="flex gap-2">
              <select
                value={countryCode}
                onChange={(event) => {
                  const nextCode = event.target.value;
                  setCountryCode(nextCode);
                  setPhone((current) => normalizeLocalPhoneInput(current, nextCode));
                }}
                className="w-[116px] shrink-0 rounded-lg border border-gray-200 px-2 py-3 text-sm text-text outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
                aria-label="选择国家区号"
              >
                {COUNTRY_CODES.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.code} {item.label}
                  </option>
                ))}
              </select>
              <input
                id="student-login-phone"
                name="tel"
                autoComplete="tel-national"
                inputMode="tel"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(normalizeLocalPhoneInput(event.target.value, countryCode))}
                placeholder={countryCode === '+86' ? '请输入手机号' : '请输入本地号码'}
                className="min-w-0 flex-1 rounded-lg border border-gray-200 px-4 py-3 text-text outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-text">验证码</label>
            <div className="flex gap-3">
              <input
                aria-label="验证码"
                autoComplete="one-time-code"
                inputMode="numeric"
                type="text"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="请输入验证码"
                className="min-w-0 flex-1 rounded-lg border border-gray-200 px-4 py-3 text-text outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
                required
              />
              <button
                type="button"
                onClick={sendCode}
                disabled={sendingCode || cooldownSeconds > 0}
                className="shrink-0 rounded-lg border border-gold px-4 py-3 text-sm font-medium text-gold transition hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sendingCode ? '发送中' : cooldownSeconds > 0 ? `${cooldownSeconds} 秒后重试` : '获取验证码'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-crimson px-4 py-3 font-medium text-white transition hover:bg-crimson-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>

        {error && (
          <div className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {notice && (
          <div className="mt-5 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
            {notice}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
