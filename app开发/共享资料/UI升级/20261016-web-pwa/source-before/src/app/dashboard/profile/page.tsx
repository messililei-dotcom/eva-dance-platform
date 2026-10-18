'use client';

import { ChangeEvent, FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Award,
  Bell,
  BookOpen,
  CalendarDays,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  Copy,
  LogIn,
  LogOut,
  MapPin,
  Phone,
  RefreshCw,
  Save,
  UserRound,
} from 'lucide-react';
import {
  studentApi,
  type StudentCertificate,
  type StudentCompetitionEntry,
  type StudentCourse,
  type StudentMember,
  type StudentPayment,
  type StudentRegionOptions,
} from '@/lib/student-api';
import {
  getStudentSession,
  preferredStudentName,
  updateStudentSessionId,
  updateStudentSessionName,
} from '@/lib/student-auth';
import {
  buildStudentConnectionDiagnostics,
  createStudentConnectionTimeoutFailure,
  normalizeStudentConnectionFailure,
  STUDENT_CONNECTION_TIMEOUT_MS,
  type StudentConnectionFailure,
} from '@/lib/student-connection';
import { getCourseVideoHref } from '@/lib/course-series-ids';
import { SmsSendGuard, smsRetryAfterSeconds, smsSendErrorMessage } from '@/lib/sms-verification';

const emptyMember: StudentMember = {
  id: '',
  name: '',
  phone: '',
  avatar: '',
  level: '',
  wxNickname: '',
  wxName: '',
  wxAccount: '',
  wxAvatarUrl: '',
  wxOpenid: '',
  wxUnionid: '',
  wxProfileSyncedAt: '',
  isWechatBound: false,
  gender: '',
  birthday: '',
  country: '中国',
  province: '',
  city: '',
  address: '',
  remark: '',
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

const DEFAULT_REGION_OPTIONS: StudentRegionOptions = {
  countries: ['中国', '中国香港', '中国澳门', '中国台湾', '海外'],
  provinces: [],
  citiesByProvince: {},
};

function formatMoney(value: number) {
  return Number.isFinite(value) ? `¥${value.toFixed(value % 1 ? 2 : 0)}` : '¥0';
}

function displayNameOf(member: StudentMember) {
  return preferredStudentName(member, '学员');
}

function avatarOf(member: StudentMember) {
  return member.wxAvatarUrl || member.avatar || '';
}

function readTokenPhone() {
  if (typeof window === 'undefined') return '';
  try {
    const token = window.localStorage.getItem('student_token') || '';
    const payload = token.split('.')[0] || token.split('.')[1] || '';
    if (!payload) return '';
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = `${normalized}${'='.repeat((4 - normalized.length % 4) % 4)}`;
    const body = JSON.parse(window.atob(padded)) as { phone?: unknown };
    return String(body.phone || '').trim();
  } catch {
    return '';
  }
}

function normalizeLocalPhoneInput(value: string, countryCode: string) {
  if (value.trim().startsWith('+')) return value.replace(/[^\d+]/g, '').slice(0, 16);
  const maxLength = countryCode === '+86' ? 11 : 14;
  return value.replace(/\D/g, '').slice(0, maxLength);
}

function validPhoneInput(phone: string, countryCode: string) {
  const digits = phone.replace(/\D/g, '');
  if (phone.trim().startsWith('+')) return /^\+\d{6,15}$/.test(phone);
  if (countryCode === '+86') return /^1[3-9]\d{9}$/.test(digits);
  return digits.length >= 4 && digits.length <= 14;
}

function StatPill({ icon, value, label }: { icon: ReactNode; value: number | string; label: string }) {
  return (
    <div className="flex min-w-0 items-center justify-center gap-1.5 px-1 py-0.5 lg:justify-start lg:rounded-xl lg:bg-[#FBF7F0] lg:px-3 lg:py-3">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[#B99652]">{icon}</span>
      <span className="text-base font-bold leading-none text-[#2C1810] lg:text-xl">{value}</span>
      <span className="whitespace-nowrap text-[11px] text-[#8A7A68] lg:text-xs">{label}</span>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [member, setMember] = useState<StudentMember>(emptyMember);
  const [courses, setCourses] = useState<StudentCourse[]>([]);
  const [payments, setPayments] = useState<StudentPayment[]>([]);
  const [certificates, setCertificates] = useState<StudentCertificate[]>([]);
  const [competitions, setCompetitions] = useState<StudentCompetitionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadFailure, setLoadFailure] = useState<StudentConnectionFailure | null>(null);
  const [loadMemberId, setLoadMemberId] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [bindCountryCode, setBindCountryCode] = useState('+86');
  const [bindPhone, setBindPhone] = useState('');
  const [bindCode, setBindCode] = useState('');
  const [bindCodeSending, setBindCodeSending] = useState(false);
  const [bindCooldownSeconds, setBindCooldownSeconds] = useState(0);
  const bindCodeGuardRef = useRef(new SmsSendGuard());
  const [loginPhone, setLoginPhone] = useState('');
  const [regionOptions, setRegionOptions] = useState<StudentRegionOptions>(DEFAULT_REGION_OPTIONS);

  const onlineCourses = courses;
  // Payment records belong to the offline training system. Keep the complete
  // history instead of filtering by course-name keywords, which hid cards
  // such as 次卡 and 年卡 as well as completed courses.
  const offlineCourses = useMemo(
    () => [...payments].sort((left, right) => {
      const leftCompleted = left.remainingSessions <= 0 ? 1 : 0;
      const rightCompleted = right.remainingSessions <= 0 ? 1 : 0;
      if (leftCompleted !== rightCompleted) return leftCompleted - rightCompleted;
      return String(right.date || '').localeCompare(String(left.date || ''));
    }),
    [payments],
  );
  const offlineCourseSummary = useMemo(() => ({
    unfinished: offlineCourses.filter(course => course.remainingSessions > 0).length,
    graduated: offlineCourses.filter(course => course.remainingSessions <= 0).length,
  }), [offlineCourses]);
  const displayName = displayNameOf(member);
  const avatar = avatarOf(member);
  const avatarKey = avatar || displayName;
  const knownPhone = member.phone || loginPhone;
  const phoneBound = Boolean(knownPhone);
  const wechatBound = Boolean(member.isWechatBound || member.wxOpenid || member.wxUnionid);
  const countryOptions = useMemo(
    () => Array.from(new Set([member.country || '中国', ...regionOptions.countries])).filter(Boolean),
    [member.country, regionOptions.countries]
  );
  const provinceOptions = useMemo(
    () => Array.from(new Set([member.province || '', ...regionOptions.provinces])).filter(Boolean),
    [member.province, regionOptions.provinces]
  );
  const cityOptions = useMemo(() => {
    const cities = regionOptions.citiesByProvince[member.province || ''] || [];
    return Array.from(new Set([member.city || '', ...cities])).filter(Boolean);
  }, [member.city, member.province, regionOptions.citiesByProvince]);

  useEffect(() => {
    if (bindCooldownSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setBindCooldownSeconds(bindCodeGuardRef.current.remainingSeconds());
    }, 250);
    return () => window.clearInterval(timer);
  }, [bindCooldownSeconds]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const bindError = params.get('wechat_bind_error') || '';
    const bindSucceeded = params.get('wechat_bound') === '1';
    if (!bindError && !bindSucceeded) return;
    setProfileOpen(true);
    setMessage(bindError || '微信绑定成功');
    params.delete('wechat_bind_error');
    params.delete('wechat_bound');
    const query = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
  }, []);

  useEffect(() => {
    if (!member.id) {
      setUnreadMessageCount(0);
      return;
    }

    let active = true;
    const refreshUnreadMessages = async () => {
      try {
        const count = await studentApi.getUnreadMessageCount();
        if (active) setUnreadMessageCount(count);
      } catch {
        if (active) setUnreadMessageCount(0);
      }
    };

    refreshUnreadMessages();
    const timer = window.setInterval(refreshUnreadMessages, 60_000);
    window.addEventListener('focus', refreshUnreadMessages);
    window.addEventListener('student-inbox-changed', refreshUnreadMessages);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshUnreadMessages);
      window.removeEventListener('student-inbox-changed', refreshUnreadMessages);
    };
  }, [member.id]);

  useEffect(() => {
    setLoading(true);
    setLoadFailure(null);
    setCopyStatus('');
    let mounted = true;
    let cachedProfileAvailable = false;
    let watchdog: ReturnType<typeof setTimeout> | undefined;

    const finishWithFailure = (failure: StudentConnectionFailure) => {
      if (!mounted) return;
      if (failure.type === 'auth') {
        studentApi.clearAuth();
        setLoading(false);
        router.replace('/?login=1&reason=session_expired');
        return;
      }
      if (cachedProfileAvailable) {
        setLoadFailure(null);
        setMessage(`当前展示上次保存的个人资料，最新数据连接失败（${failure.code}），可稍后重新进入更新。`);
      } else {
        setLoadFailure(failure);
      }
      setLoading(false);
    };

    const applyCachedProfile = (cached: StudentMember, storedPhone: string) => {
      const cachedProfile = { ...emptyMember, ...cached, phone: cached.phone || storedPhone };
      cachedProfileAvailable = true;
      setMember(cachedProfile);
      setCourses(cached.authorizedCourses || []);
      setPayments(cached.payments || []);
      setLoading(false);
    };

    async function loadProfile() {
      try {
        const session = getStudentSession();
        if (!session) {
          router.replace('/?login=1');
          return;
        }
        const memberId = session.id;
        setLoadMemberId(memberId);
        const cached = studentApi.getStoredMember(memberId);
        const storedPhone = cached?.phone || readTokenPhone();
        setLoginPhone(storedPhone);

        // Returning students can enter the personal center immediately. Fresh
        // data continues syncing in the background instead of blocking the UI.
        if (cached?.id) applyCachedProfile(cached, storedPhone);

        const [profile, homeData, certRows, competitionRows, regions] = await Promise.all([
          studentApi.getMember(memberId),
          studentApi.getHomeData(memberId),
          studentApi.getCertificates(memberId).catch(() => []),
          studentApi.getCompetitions(memberId).catch(() => []),
          studentApi.getRegionOptions(memberId).catch(() => DEFAULT_REGION_OPTIONS),
        ]);
        if (!mounted) return;
        const mergedProfile = { ...emptyMember, ...profile, phone: profile.phone || storedPhone };
        setRegionOptions(regions);
        setMember(mergedProfile);
        if (profile.id) updateStudentSessionId(profile.id);
        if (displayNameOf(mergedProfile)) updateStudentSessionName(displayNameOf(mergedProfile));
        setCourses(homeData.courses || []);
        setPayments(homeData.payments || []);
        studentApi.storeMemberSnapshot({
          ...mergedProfile,
          authorizedCourses: homeData.courses || [],
          payments: homeData.payments || [],
        });
        setCertificates(certRows || []);
        setCompetitions(competitionRows || []);
      } catch (error) {
        finishWithFailure(normalizeStudentConnectionFailure(error));
      } finally {
        if (watchdog) clearTimeout(watchdog);
        if (mounted) setLoading(false);
      }
    }

    watchdog = setTimeout(() => {
      finishWithFailure(createStudentConnectionTimeoutFailure(
        typeof window === 'undefined' ? '/dashboard/profile' : window.location.href,
      ));
    }, STUDENT_CONNECTION_TIMEOUT_MS);
    loadProfile();
    return () => {
      mounted = false;
      if (watchdog) clearTimeout(watchdog);
    };
  }, [router, loadAttempt]);

  const copyDiagnostics = async () => {
    if (!loadFailure) return;
    const text = buildStudentConnectionDiagnostics(loadFailure, { memberId: loadMemberId });
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus('排查信息已复制');
    } catch {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand('copy');
        textarea.remove();
        if (!copied) throw new Error('copy failed');
        setCopyStatus('排查信息已复制');
      } catch {
        setCopyStatus('复制失败，请截图错误编码反馈');
      }
    }
  };

  const updateField = (field: keyof StudentMember, value: string) => {
    setMember((current) => {
      if (field === 'name') return { ...current, name: value, wxName: current.wxName || value, wxNickname: current.wxNickname || value };
      if (field === 'wxName' || field === 'wxNickname') return { ...current, name: value, wxName: value, wxNickname: value };
      if (field === 'avatar' || field === 'wxAvatarUrl') return { ...current, avatar: value, wxAvatarUrl: value };
      if (field === 'country') return { ...current, country: value };
      if (field === 'province') {
        const cities = regionOptions.citiesByProvince[value] || [];
        return { ...current, province: value, city: cities.includes(current.city || '') ? current.city : '' };
      }
      return { ...current, [field]: value };
    });
  };

  const handleAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !member.id) return;
    setSaving(true);
    setMessage('');
    try {
      const updated = await studentApi.uploadAvatar(member.id, file);
      setMember((current) => {
        const nextAvatar = updated.wxAvatarUrl || updated.avatar || current.wxAvatarUrl || current.avatar;
        return { ...current, avatar: nextAvatar, wxAvatarUrl: nextAvatar };
      });
      setMessage('头像已更新');
    } catch (error: any) {
      setMessage(error?.message || '头像上传失败');
    } finally {
      setSaving(false);
      event.target.value = '';
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextName = displayNameOf(member).trim();
    if (!member.id || !nextName) {
      setMessage('请填写姓名');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const updated = await studentApi.updateMember(member.id, {
        ...member,
        name: nextName,
        wxName: member.wxName || nextName,
        wxNickname: member.wxNickname || member.wxName || nextName,
        avatar: avatarOf(member),
        wxAvatarUrl: avatarOf(member),
      });
      const merged = { ...emptyMember, ...updated };
      setMember(merged);
      if (merged.id) updateStudentSessionId(merged.id);
      updateStudentSessionName(displayNameOf(merged));
      setMessage('个人资料已保存');
    } catch (error: any) {
      setMessage(error?.message || '保存失败，请稍后再试');
    } finally {
      setSaving(false);
    }
  };

  const handleWechatOAuth = () => {
    const isWechat = /MicroMessenger/i.test(window.navigator.userAgent);
    const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
    if (!isWechat && !isDesktop) {
      setMessage('请在微信内打开官网后点击“绑定微信”。');
      setProfileOpen(true);
      return;
    }
    setMessage('正在跳转微信授权...');
    const mode = isWechat ? 'wechat' : 'qr';
    window.location.assign(`/api/wechat/oauth/start?purpose=bind&mode=${mode}&next=${encodeURIComponent('/dashboard/profile')}`);
  };

  const handleSyncWechatProfile = async () => {
    if (!member.id) return;
    const nextName = displayNameOf(member);
    setSaving(true);
    setMessage('');
    try {
      const updated = await studentApi.syncWechatProfile({
        memberId: member.id,
        nickname: nextName,
        wxName: nextName,
        wxAccount: member.wxAccount || '',
        avatarUrl: avatarOf(member),
      });
      const merged = { ...emptyMember, ...updated };
      setMember(merged);
      if (merged.id) updateStudentSessionId(merged.id);
      updateStudentSessionName(displayNameOf(merged));
      setMessage('个人资料已同步');
    } catch (error: any) {
      setMessage(error?.message || '个人资料同步失败');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    studentApi.clearAuth();
    router.replace('/');
  };

  const refreshMemberData = async (memberId: string) => {
    const [homeData, certRows, competitionRows] = await Promise.all([
      studentApi.getHomeData(memberId),
      studentApi.getCertificates(memberId).catch(() => []),
      studentApi.getCompetitions(memberId).catch(() => []),
    ]);
    setCourses(homeData.courses || []);
    setPayments(homeData.payments || []);
    setCertificates(certRows || []);
    setCompetitions(competitionRows || []);
  };

  const handleBindPhone = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!member.id) return;
    if (!validPhoneInput(bindPhone, bindCountryCode)) {
      setMessage('请输入正确的手机号');
      return;
    }
    if (!bindCode) {
      setMessage('请输入短信验证码');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const updated = await studentApi.bindPhone(bindPhone, bindCode, bindCountryCode);
      const merged = { ...emptyMember, ...updated };
      setMember(merged);
      if (merged.id) {
        updateStudentSessionId(merged.id);
        await refreshMemberData(String(merged.id));
      }
      updateStudentSessionName(displayNameOf(merged));
      setBindPhone('');
      setBindCode('');
      setMessage('手机号已绑定，课程资料已同步');
    } catch (error: any) {
      setMessage(error?.message || '手机号绑定失败，请稍后再试');
    } finally {
      setSaving(false);
    }
  };

  const handleSendBindCode = async () => {
    if (!validPhoneInput(bindPhone, bindCountryCode)) {
      setMessage('请输入正确的手机号');
      return;
    }
    if (!bindCodeGuardRef.current.tryStart()) {
      const remaining = bindCodeGuardRef.current.remainingSeconds();
      if (remaining > 0) setMessage(`操作过于频繁，请 ${remaining} 秒后重试`);
      return;
    }
    setBindCodeSending(true);
    setMessage('');
    try {
      const result = await studentApi.sendCode(bindPhone, bindCountryCode);
      bindCodeGuardRef.current.succeed();
      setBindCooldownSeconds(bindCodeGuardRef.current.remainingSeconds());
      const devCode = result?.devCode || result?.code;
      if (devCode) setBindCode(String(devCode));
      setMessage(devCode ? `验证码：${devCode}` : '验证码已发送，请查收短信');
    } catch (error) {
      const retryAfter = smsRetryAfterSeconds(error);
      if (retryAfter > 0) {
        bindCodeGuardRef.current.cooldown(retryAfter);
        setBindCooldownSeconds(bindCodeGuardRef.current.remainingSeconds());
      } else {
        bindCodeGuardRef.current.fail();
      }
      setMessage(smsSendErrorMessage(error));
    } finally {
      setBindCodeSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F3EA] px-4 text-[#8A7A68]">
        <div className="text-center">
          <RefreshCw className="mx-auto mb-3 h-6 w-6 animate-spin text-[#B99652]" />
          <p>正在连接个人中心...</p>
          <p className="mt-2 text-xs text-[#A49685]">最长等待 15 秒</p>
        </div>
      </div>
    );
  }

  if (loadFailure) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8F3EA] px-4 py-20 text-[#2C1810]">
        <section className="w-full max-w-md rounded-2xl border border-[#E8DDCB] bg-white p-6 text-center shadow-sm" role="alert">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#FFF2E8] text-[#A64B18]">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-xl font-bold">{loadFailure.title}</h1>
          <p className="mt-2 text-sm leading-6 text-[#6F6257]">{loadFailure.message}</p>
          <div className="mt-4 rounded-xl bg-[#F8F3EA] px-4 py-3 text-left text-xs leading-5 text-[#76695E]">
            <p>错误编码：{loadFailure.code}</p>
            <p className="break-all">请求ID：{loadFailure.requestId}</p>
          </div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#9F1D20] px-5 py-3 text-sm font-semibold text-white">
              <RefreshCw className="h-4 w-4" />
              重新连接
            </button>
            <button type="button" onClick={copyDiagnostics} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#D8C7AE] bg-white px-5 py-3 text-sm font-semibold text-[#7E6233]">
              {copyStatus === '排查信息已复制' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              复制排查信息
            </button>
          </div>
          {loadFailure.type === 'auth' ? (
            <button type="button" onClick={() => router.replace('/?login=1')} className="mt-3 inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-[#9F1D20]">
              <LogIn className="h-4 w-4" />
              重新登录
            </button>
          ) : null}
          {copyStatus ? <p className="mt-3 text-xs text-[#8A6A32]" role="status">{copyStatus}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="student-profile-page min-h-screen bg-[#F8F3EA] px-3 pb-0 pt-[calc(env(safe-area-inset-top)+1rem)] text-[#2C1810] md:px-4 md:py-3 lg:px-8 lg:pb-10 lg:pt-24">
      <div className="mx-auto max-w-[1280px]">
        <div className="flex items-center justify-between py-1 lg:mb-6 lg:py-0">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/75 text-[#8A6A32] shadow-sm md:h-10 md:w-10 lg:hidden"
            aria-label="返回"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="hidden flex-1 lg:block">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#B99652]">Student Center</p>
            <h1 className="mt-1 font-serif text-3xl font-bold text-[#2C1810]">我的个人中心</h1>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl bg-white lg:grid lg:grid-cols-[380px_minmax(0,1fr)] lg:items-start lg:gap-6 lg:overflow-visible lg:bg-transparent">
        <aside className="lg:sticky lg:top-24 lg:space-y-4">
        <section className="overflow-hidden bg-white lg:rounded-2xl lg:border lg:border-[#E8DDCB] lg:shadow-[0_18px_50px_rgba(70,45,20,0.08)]">
          <div className="bg-gradient-to-br from-[#7F171B] via-[#9F3432] to-[#B99652] px-4 py-2.5 text-white md:px-5 md:py-3 lg:px-6 lg:py-7">
            <div className="flex items-center justify-between gap-1.5 min-[360px]:gap-2 min-[390px]:gap-3 lg:block">
              <div className="flex min-w-0 flex-1 items-center gap-2 min-[390px]:gap-3 md:gap-4 lg:items-start">
                <label className="relative flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-white/20 text-lg font-bold ring-2 ring-white/30 min-[360px]:h-12 min-[360px]:w-12 min-[390px]:h-14 min-[390px]:w-14 min-[390px]:text-xl md:h-16 md:w-16 md:text-2xl lg:h-20 lg:w-20">
                  {avatar ? (
                    <Image key={avatarKey} src={avatar} alt={displayName || '头像'} fill sizes="72px" className="object-contain" unoptimized />
                  ) : (
                    displayName?.slice(0, 1) || <UserRound className="h-7 w-7 md:h-8 md:w-8" />
                  )}
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={handleAvatar} />
                  <span className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[#9F1D20] md:h-6 md:w-6">
                    <Camera className="h-3 w-3 md:h-3.5 md:w-3.5" />
                  </span>
                </label>
                <div className="min-w-0 flex-1">
                  <h1 className="truncate whitespace-nowrap text-[clamp(1rem,5vw,1.25rem)] font-bold leading-tight md:text-2xl lg:text-[26px]">{displayName}</h1>
                  <p className="mt-0.5 flex min-w-0 items-center overflow-hidden text-[11px] leading-5 text-white/80 min-[390px]:text-xs md:mt-1 md:text-sm">
                    <span className="min-w-0 truncate whitespace-nowrap">{member.level || '学员'}</span>
                    <span className="mx-1 shrink-0">·</span>
                    <span className="shrink-0 whitespace-nowrap tabular-nums">{knownPhone || '未绑定手机号'}</span>
                  </p>
                  <p className="mt-0.5 truncate whitespace-nowrap text-[11px] text-white/70 min-[390px]:text-xs md:mt-1">个人中心</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1 lg:mt-5 lg:w-full lg:gap-2">
                <Link
                  href="/dashboard/messages"
                  className="relative inline-flex items-center gap-0.5 whitespace-nowrap rounded-full bg-white/15 px-1.5 py-1.5 text-[10px] font-semibold text-white transition hover:bg-white/25 min-[360px]:gap-1 min-[360px]:px-2 min-[390px]:px-2.5 min-[390px]:text-xs lg:flex-1 lg:justify-center lg:px-3 lg:py-2"
                  aria-label={unreadMessageCount ? `我的通知，${unreadMessageCount}条新通知` : '我的通知'}
                >
                  <Bell className="h-3.5 w-3.5" />
                  <span>通知</span>
                  {unreadMessageCount > 0 ? (
                    <span className="absolute -right-1.5 -top-1.5 min-w-4 rounded-full bg-[#E02020] px-1 text-center text-[10px] font-bold leading-4 text-white shadow-sm">
                      {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                    </span>
                  ) : null}
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-0.5 whitespace-nowrap rounded-full bg-white/15 px-1.5 py-1.5 text-[10px] font-semibold text-white min-[360px]:gap-1 min-[360px]:px-2 min-[390px]:px-2.5 min-[390px]:text-xs lg:flex-1 lg:justify-center lg:px-3 lg:py-2"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  退出
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1 px-3 py-1 md:gap-2 md:px-4 md:py-1.5 lg:grid-cols-2 lg:p-4">
            <StatPill icon={<BookOpen className="h-4 w-4" />} value={onlineCourses.length} label="线上课" />
            <StatPill icon={<CalendarDays className="h-4 w-4" />} value={offlineCourses.length} label="线下课" />
            <StatPill icon={<Award className="h-4 w-4" />} value={competitions.length} label="比赛" />
            <StatPill icon={<Award className="h-4 w-4" />} value={certificates.length} label="证书" />
          </div>
        </section>

        {!phoneBound ? (
          <form onSubmit={handleBindPhone} className="border-t border-[#F1E7D8] bg-white p-2 md:p-2.5 lg:rounded-2xl lg:border lg:border-[#E8DDCB] lg:p-4 lg:shadow-sm">
            <div className="mb-1.5 flex items-start gap-2">
              <Phone className="mt-0.5 h-5 w-5 shrink-0 text-[#B99652]" />
              <div>
                <h2 className="text-base font-bold">绑定手机号</h2>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex gap-2">
                <select
                  value={bindCountryCode}
                  onChange={(event) => {
                    const nextCode = event.target.value;
                    setBindCountryCode(nextCode);
                    setBindPhone((current) => normalizeLocalPhoneInput(current, nextCode));
                  }}
                  className="w-[104px] shrink-0 rounded-xl border border-[#E8DDCB] bg-white px-2 py-2.5 text-sm outline-none focus:border-[#B99652]"
                  aria-label="选择国家区号"
                >
                  {COUNTRY_CODES.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.code} {item.label}
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  value={bindPhone}
                  onChange={(event) => setBindPhone(normalizeLocalPhoneInput(event.target.value, bindCountryCode))}
                  placeholder={bindCountryCode === '+86' ? '手机号' : '本地号码'}
                  className="min-w-0 flex-1 rounded-xl border border-[#E8DDCB] px-3 py-2.5 outline-none focus:border-[#B99652]"
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  value={bindCode}
                  onChange={(event) => setBindCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="短信验证码"
                  className="min-w-0 flex-1 rounded-xl border border-[#E8DDCB] px-3 py-2.5 outline-none focus:border-[#B99652]"
                />
                <button
                  type="button"
                  onClick={handleSendBindCode}
                  disabled={bindCodeSending || bindCooldownSeconds > 0}
                  className="shrink-0 rounded-xl border border-[#B99652] px-3 py-2.5 text-sm font-semibold text-[#9A793D] disabled:opacity-60"
                >
                  {bindCodeSending ? '发送中' : bindCooldownSeconds > 0 ? `${bindCooldownSeconds}秒` : '获取验证码'}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="shrink-0 rounded-xl bg-[#9F1D20] px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {saving ? '绑定中' : '确认绑定'}
                </button>
              </div>
            </div>
          </form>
        ) : null}

        </aside>

        <div className="min-w-0 space-y-0 lg:space-y-6">
        <Link href="/shop/selection?orders=1" className="block border-b bg-white px-5 py-4 font-semibold">我的订单 <span className="ml-2 text-sm font-normal text-stone-500">课程、商品、支付与退款</span></Link>
        <section className="border-t border-[#F1E7D8] bg-transparent p-0 lg:overflow-hidden lg:rounded-2xl lg:border lg:border-[#E8DDCB] lg:bg-white lg:shadow-sm">
          <div className="flex items-center bg-white">
            <button
              type="button"
              onClick={() => setProfileOpen((value) => !value)}
              className="flex min-w-0 flex-1 items-center px-3 py-1.5 text-left lg:px-6 lg:py-5"
              aria-expanded={profileOpen}
            >
              <span className="flex min-w-0 items-center gap-2">
                <UserRound className="h-5 w-5 shrink-0 text-[#B99652]" />
                <span className="min-w-0">
                  <span className="block text-base font-bold">个人资料</span>
                  <span className="block break-words text-xs leading-5 text-[#8A7A68]">
                    微信名、头像、手机号、生日和地址
                  </span>
                </span>
              </span>
            </button>
            {wechatBound ? (
              <span className="mr-1.5 inline-flex shrink-0 items-center gap-1 rounded-full bg-[#EAF7EA] px-2.5 py-1.5 text-xs font-semibold text-[#168315] lg:mr-3">
                <Check className="h-3.5 w-3.5" />
                已绑定
              </span>
            ) : (
              <button
                type="button"
                onClick={handleWechatOAuth}
                className="mr-1.5 shrink-0 rounded-full bg-[#1AAD19] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#159B16] lg:mr-3 lg:px-4 lg:py-2"
              >
                绑定微信
              </button>
            )}
            <button
              type="button"
              onClick={() => setProfileOpen((value) => !value)}
              className="mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#8A6A32] lg:mr-4"
              aria-label={profileOpen ? '收起个人资料' : '展开个人资料'}
              aria-expanded={profileOpen}
            >
              <ChevronDown className={`h-5 w-5 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {message ? <p className="mt-0 bg-white px-3 py-1.5 text-sm text-[#9F1D20]">{message}</p> : null}

          {profileOpen ? (
            <form onSubmit={handleSubmit} className="mt-0 space-y-1.5 bg-white p-2 md:p-2.5 lg:space-y-5 lg:border-t lg:border-[#F1E7D8] lg:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">个人资料</h2>
                  <p className="mt-1 text-xs text-[#8A7A68]">
                    {wechatBound ? '微信身份已绑定' : '尚未绑定微信身份'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={handleWechatOAuth}
                    className="rounded-full bg-[#F8F3EA] px-3 py-2 text-xs font-semibold text-[#8A6A32]"
                  >
                    {wechatBound ? '微信授权同步' : '绑定微信'}
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#9F1D20] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" />
                    {saving ? '保存中' : '保存'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5 md:gap-2 lg:gap-4">
                <label className="min-w-0 space-y-1 text-sm font-semibold">
                  <span>姓名</span>
                  <input value={displayName} onChange={(e) => updateField('wxName', e.target.value)} className="min-w-0 w-full rounded-xl border border-[#E8DDCB] px-2.5 py-2.5 outline-none focus:border-[#B99652] sm:px-3" />
                </label>
                <label className="min-w-0 space-y-1 text-sm font-semibold">
                  <span>手机号</span>
                  <input value={knownPhone || ''} readOnly className="min-w-0 w-full rounded-xl border border-[#E8DDCB] bg-[#F8F3EA] px-2.5 py-2.5 text-[#8A7A68] sm:px-3" placeholder="未绑定手机号" />
                </label>
                <label className="col-span-2 space-y-1 text-sm font-semibold">
                  <span>微信号</span>
                  <input
                    value={member.wxAccount || ''}
                    onChange={(e) => updateField('wxAccount', e.target.value)}
                    className="w-full rounded-xl border border-[#E8DDCB] px-2.5 py-2.5 outline-none focus:border-[#B99652] sm:px-3"
                    placeholder="微信官方不会自动返回微信号，请手动填写"
                  />
                </label>
                <label className="space-y-1 text-sm font-semibold">
                  <span>性别</span>
                  <select value={member.gender || ''} onChange={(e) => updateField('gender', e.target.value)} className="w-full rounded-xl border border-[#E8DDCB] px-2.5 py-2.5 outline-none focus:border-[#B99652] sm:px-3">
                    <option value="">未填写</option>
                    <option value="女">女</option>
                    <option value="男">男</option>
                  </select>
                </label>
                <label className="space-y-1 text-sm font-semibold">
                  <span>生日</span>
                  <input type="date" value={member.birthday || ''} onChange={(e) => updateField('birthday', e.target.value)} className="w-full rounded-xl border border-[#E8DDCB] px-2.5 py-2.5 outline-none focus:border-[#B99652] sm:px-3" />
                </label>
                <label className="space-y-1 text-sm font-semibold">
                  <span>国家/地区</span>
                  <select value={member.country || '中国'} onChange={(e) => updateField('country', e.target.value)} className="w-full rounded-xl border border-[#E8DDCB] px-2.5 py-2.5 outline-none focus:border-[#B99652] sm:px-3">
                    {countryOptions.map((country) => (
                      <option key={country} value={country}>{country}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-sm font-semibold">
                  <span>省份/地区</span>
                  <select value={member.province || ''} onChange={(e) => updateField('province', e.target.value)} className="w-full rounded-xl border border-[#E8DDCB] px-2.5 py-2.5 outline-none focus:border-[#B99652] sm:px-3">
                    <option value="">请选择</option>
                    {provinceOptions.map((province) => (
                      <option key={province} value={province}>{province}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-sm font-semibold">
                  <span>城市</span>
                  <select value={member.city || ''} onChange={(e) => updateField('city', e.target.value)} className="w-full rounded-xl border border-[#E8DDCB] px-2.5 py-2.5 outline-none focus:border-[#B99652] sm:px-3">
                    <option value="">请选择</option>
                    {cityOptions.map((city) => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                </label>
                <label className="col-span-2 space-y-1 text-sm font-semibold">
                  <span>地址</span>
                  <input value={member.address || ''} onChange={(e) => updateField('address', e.target.value)} className="w-full rounded-xl border border-[#E8DDCB] px-2.5 py-2.5 outline-none focus:border-[#B99652] sm:px-3" />
                </label>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl bg-[#F8F3EA] px-2.5 py-1.5 text-xs text-[#8A7A68]">
                <span className="min-w-0 flex-1 break-words leading-5">
                  {member.wxProfileSyncedAt ? `最近同步：${member.wxProfileSyncedAt}` : '个人姓名默认使用微信名，头像默认使用微信头像'}
                </span>
                <button
                  type="button"
                  onClick={handleSyncWechatProfile}
                  disabled={saving}
                  className="shrink-0 rounded-full bg-[#9F1D20] px-3 py-1.5 font-semibold text-white disabled:opacity-60"
                >
                  {saving ? '同步中' : '同步资料'}
                </button>
              </div>
            </form>
          ) : null}
        </section>

        <section className="border-t border-[#F1E7D8] bg-white p-2 md:p-2.5 lg:rounded-2xl lg:border lg:border-[#E8DDCB] lg:p-6 lg:shadow-sm" id="online-courses">
          <div className="mb-1.5 flex items-center justify-between lg:mb-5">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold lg:text-2xl"><BookOpen className="h-5 w-5 shrink-0 text-[#B99652] lg:h-6 lg:w-6" /><span>我的线上课程</span></h2>
              <p className="mt-1 hidden text-sm text-[#8A7A68] lg:block">继续学习已授权课程，进度会在多端同步</p>
            </div>
            <Link href="/courses" className="hidden rounded-full bg-[#F8F3EA] px-4 py-2 text-sm font-semibold text-[#8A6A32] lg:inline-flex">全部课程</Link>
          </div>
          {onlineCourses.length ? (
            <div className="space-y-1.5 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
              {onlineCourses.map((course) => (
                <a
                  key={course.id}
                  href={getCourseVideoHref({ courseId: course.id, platformSeriesId: course.id })}
                  className="group flex items-center gap-2.5 rounded-xl bg-[#FBF8F2] p-1.5 transition sm:p-2 lg:border lg:border-transparent lg:p-3 lg:hover:-translate-y-0.5 lg:hover:border-[#DFCBAA] lg:hover:bg-white lg:hover:shadow-md"
                >
                  <div className="relative aspect-[4/3] w-20 shrink-0 overflow-hidden rounded-lg bg-[#F8F3EA] sm:w-24 lg:w-28">
                    {course.cover ? <Image src={course.cover} alt={course.title} fill sizes="(max-width: 640px) 80px, 96px" className="object-cover" unoptimized /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="break-words text-sm font-semibold leading-5 sm:text-base">{course.title}</div>
                    <div className="mt-1 text-xs text-[#8A7A68]">{course.lessons || 0} 节 · 已学 {course.progress || 0}%</div>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <p className="rounded-xl bg-[#F8F3EA] p-2 text-sm text-[#8A7A68]">暂无已授权线上课程</p>
          )}
        </section>

        <div className="lg:grid lg:grid-cols-2 lg:items-stretch lg:gap-6 xl:grid-cols-3">
        <section className="border-t border-[#F1E7D8] bg-white p-2 md:p-2.5 lg:h-full lg:rounded-2xl lg:border lg:border-[#E8DDCB] lg:p-5 lg:shadow-sm" id="offline-courses">
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="flex min-w-0 items-center gap-2 text-lg font-bold"><MapPin className="h-5 w-5 shrink-0 text-[#B99652]" /><span>我的线下课程</span></h2>
              {offlineCourses.length ? <p className="mt-0.5 text-xs text-[#8A7A68]">未完成 {offlineCourseSummary.unfinished} 门 · 已毕业 {offlineCourseSummary.graduated} 门</p> : null}
            </div>
            <Link href="/offline?tab=rights" className="shrink-0 rounded-full bg-[#9F1D20] px-3 py-1.5 text-xs font-semibold text-white">查看课时</Link>
          </div>
          {offlineCourses.length ? (
            <div className="space-y-2">
              {offlineCourses.map((course) => {
                const graduated = course.remainingSessions <= 0;
                const consumedSessions = Math.max(
                  course.consumedSessions || 0,
                  Math.max(0, (course.courseSessions || 0) - (course.remainingSessions || 0)),
                );
                return (
                  <div key={course.id} className="rounded-xl border border-[#EEE2D3] bg-[#FBF8F2] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 break-words font-semibold">{course.courseName}</div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${graduated ? 'bg-[#E8F5E9] text-[#2E7D32]' : 'bg-[#FFF0D7] text-[#9A5B00]'}`}>
                        {graduated ? '已毕业' : '未完成'}
                      </span>
                    </div>
                    <div className="mt-1.5 text-xs leading-5 text-[#8A7A68]">
                      {[course.courseType, course.courseSubType].filter(Boolean).join(' · ') || '线下课程'}
                      {course.date ? ` · 报名 ${course.date}` : ''}
                    </div>
                    <div className="mt-1 text-xs leading-5 text-[#685746]">
                      已完成 {consumedSessions} 课次 · 剩余 {course.remainingSessions || 0} 课次
                      {course.courseSessions ? ` · 共 ${course.courseSessions} 课次` : ''}
                    </div>
                    <div className="mt-1 text-xs leading-5 text-[#8A7A68]">
                      实付 {formatMoney(course.amount)}
                      {course.paymentMethod ? ` · ${course.paymentMethod}` : ''}
                      {course.expireDate ? ` · 有效期至 ${course.expireDate}` : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="rounded-xl bg-[#F8F3EA] p-2 text-sm text-[#8A7A68]">暂无线下课程记录</p>
          )}
        </section>

        <Link
          href="/dashboard/events"
          className="flex items-center justify-between border-t border-[#F1E7D8] bg-white px-3 py-2 text-left lg:h-full lg:rounded-2xl lg:border lg:border-[#E8DDCB] lg:px-5 lg:py-4 lg:shadow-sm lg:transition lg:hover:-translate-y-0.5 lg:hover:border-[#D6BC91]"
        >
          <span className="flex min-w-0 items-center gap-2">
            <Award className="h-5 w-5 shrink-0 text-[#B99652]" />
            <span className="min-w-0">
              <span className="block text-base font-bold">我的比赛</span>
              <span className="block break-words text-xs leading-5 text-[#8A7A68]">{competitions.length} 个报名组别 · 评分/总分/名次</span>
            </span>
          </span>
          <ChevronLeft className="h-5 w-5 shrink-0 rotate-180 text-[#8A6A32]" />
        </Link>

        <section className="border-t border-[#F1E7D8] bg-white p-2 md:p-2.5 lg:h-full lg:rounded-2xl lg:border lg:border-[#E8DDCB] lg:p-5 lg:shadow-sm" id="certificates">
          <h2 className="mb-1.5 flex items-center gap-2 text-lg font-bold"><Award className="h-5 w-5 text-[#B99652]" />我的证书</h2>
          {certificates.length ? (
            <div className="space-y-1.5">
              {certificates.map((cert) => (
                <div key={cert.id || cert.certificateNo} className="rounded-xl bg-[#FBF8F2] p-1.5">
                  <div className="font-semibold">{cert.courseName || '结业证书'}</div>
                  <div className="mt-1 text-xs text-[#8A7A68]">编号 {cert.certificateNo || '-'} · {cert.issueDate || '-'}</div>
                  <Link href={`/dashboard/certificates?no=${encodeURIComponent(cert.certificateNo || '')}`} className="mt-2 inline-block text-sm font-semibold text-[#9F1D20]">查看证书 · 编辑姓名与下载</Link>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-xl bg-[#F8F3EA] p-2 text-sm text-[#8A7A68]">暂无证书</p>
          )}
        </section>
        </div>
        </div>
        </div>
      </div>
    </main>
  );
}
