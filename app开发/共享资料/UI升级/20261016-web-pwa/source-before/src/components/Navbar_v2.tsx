'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent, TouchEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, Search, ChevronDown, Bell, User, Sparkles, LogOut, Headphones } from 'lucide-react';
import { navItems } from '@/config/navigation';
import { cn } from '@/lib/utils';
import { clearStudentSession, getStudentSession, preferredStudentName, STUDENT_AUTH_CHANGED_EVENT } from '@/lib/student-auth';
import StudentLoginModal from '@/components/StudentLoginModal';
import SiteSearch from '@/components/SiteSearch';
import { CLOSE_CUSTOMER_SERVICE_EVENT, OPEN_CUSTOMER_SERVICE_EVENT, OPEN_STUDENT_LOGIN_EVENT } from '@/lib/ui-events';
import { studentApi } from '@/lib/student-api';
import { pwaLoginSuccessPath } from '@/lib/pwa-auth-flow';

type MobileStudent = {
  id: string;
  name: string;
  avatarUrl: string;
};

type DesktopNavbarTone = 'light' | 'dark';

/**
 * Transparent desktop navigation needs to contrast with each page's hero.
 * `light` is used over dark/photographic heroes; all other pages default to
 * dark text because their first surface is warm white.
 */
export function getDesktopNavbarTone(pathname: string): DesktopNavbarTone {
  if (pathname === '/') return 'light';

  const darkHeroRoutes = new Set([
    '/about',
    '/about/brand-story',
    '/about/students',
    '/certification',
    '/contact',
    '/courses',
    '/disciples',
    '/dance-circle',
    '/events',
    '/offline',
    '/shop',
  ]);

  if (darkHeroRoutes.has(pathname) || pathname.startsWith('/festival') || pathname.startsWith('/shop/')) return 'light';
  return 'dark';
}

function readStoredMemberRecord(): Record<string, unknown> {
  try {
    const raw = window.localStorage.getItem('student_member');
    return raw ? JSON.parse(raw) as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function readString(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return '';
}

function readMobileStudent(): MobileStudent | null {
  if (typeof window === 'undefined') return null;

  const session = getStudentSession();
  if (session) {
    const storedMember = readStoredMemberRecord();
    return {
      id: session.id,
      name: preferredStudentName(storedMember, session.name || '已登录学员'),
      avatarUrl: readString(storedMember, ['wxAvatarUrl', 'wx_avatar_url', 'avatar', 'avatarUrl', 'avatar_url', 'photo']),
    };
  }

  const legacyToken = window.localStorage.getItem('studentToken') || '';
  const legacyId = window.localStorage.getItem('studentId') || '';
  if (!legacyToken || !legacyId) return null;

  return {
    id: legacyId,
    name: window.localStorage.getItem('studentName') || '已登录学员',
    avatarUrl: '',
  };
}

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedMobileItem, setExpandedMobileItem] = useState<string | null>(null);
  const [mobileStudent, setMobileStudent] = useState<MobileStudent | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const mobileMenuTouchAtRef = useRef(0);
  const pendingLoginNextRef = useRef<string | null>(null);
  const pathname = usePathname();
  const desktopNavbarTone = getDesktopNavbarTone(pathname);
  const usesLightDesktopText = desktopNavbarTone === 'light';

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
    setExpandedMobileItem(null);
    setSearchOpen(false);
  }, [pathname]);

  useEffect(() => {
    let active = true;
    const refreshUnread = async () => {
      if (!mobileStudent) {
        if (active) setUnreadMessageCount(0);
        return;
      }
      try {
        const count = await studentApi.getUnreadMessageCount();
        if (active) setUnreadMessageCount(count);
      } catch {
        if (active) setUnreadMessageCount(0);
      }
    };
    refreshUnread();
    const timer = window.setInterval(refreshUnread, 60_000);
    window.addEventListener('focus', refreshUnread);
    window.addEventListener('student-inbox-changed', refreshUnread);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshUnread);
      window.removeEventListener('student-inbox-changed', refreshUnread);
    };
  }, [mobileStudent]);

  useEffect(() => {
    const openStudentLogin = (event: Event) => {
      const next = (event as CustomEvent<{ next?: string }>).detail?.next || '';
      pendingLoginNextRef.current = next.startsWith('/') && !next.startsWith('//') ? next : null;
      setMobileOpen(false);
      setExpandedMobileItem(null);
      setLoginOpen(true);
    };

    window.addEventListener(OPEN_STUDENT_LOGIN_EVENT, openStudentLogin);
    return () => window.removeEventListener(OPEN_STUDENT_LOGIN_EVENT, openStudentLogin);
  }, []);

  useEffect(() => {
    document.body.style.overflow = '';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    const syncStudent = () => setMobileStudent(readMobileStudent());
    syncStudent();

    window.addEventListener('storage', syncStudent);
    window.addEventListener('focus', syncStudent);
    window.addEventListener(STUDENT_AUTH_CHANGED_EVENT, syncStudent);

    return () => {
      window.removeEventListener('storage', syncStudent);
      window.removeEventListener('focus', syncStudent);
      window.removeEventListener(STUDENT_AUTH_CHANGED_EVENT, syncStudent);
    };
  }, [pathname]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('login') === '1') {
      const next = params.get('next') || '';
      pendingLoginNextRef.current = next.startsWith('/') && !next.startsWith('//') ? next : null;
      setMobileOpen(false);
      setExpandedMobileItem(null);
      setLoginOpen(true);
    }
  }, [pathname]);

  const handleMobileLogout = () => {
    clearStudentSession();
    setMobileStudent(null);
    setUnreadMessageCount(0);
    setMobileOpen(false);
    window.location.assign('/');
  };

  const openMobileLogin = () => {
    pendingLoginNextRef.current = null;
    setMobileOpen(false);
    setExpandedMobileItem(null);
    setLoginOpen(true);
  };

  const toggleMobileMenu = useCallback(() => {
    window.dispatchEvent(new CustomEvent(CLOSE_CUSTOMER_SERVICE_EVENT));
    setMobileOpen((open) => !open);
  }, []);

  const handleMobileMenuTouchEnd = (event: TouchEvent<HTMLButtonElement>) => {
    event.preventDefault();
    mobileMenuTouchAtRef.current = Date.now();
    toggleMobileMenu();
  };

  const handleMobileMenuClick = () => {
    if (Date.now() - mobileMenuTouchAtRef.current < 650) return;
    toggleMobileMenu();
  };

  const closeMobileMenu = useCallback(() => {
    setMobileOpen(false);
    setExpandedMobileItem(null);
  }, []);

  const navigateFromMobileMenu = useCallback((event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (
      event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.shiftKey
      || event.altKey
    ) {
      return;
    }

    event.preventDefault();
    closeMobileMenu();
    window.dispatchEvent(new CustomEvent(CLOSE_CUSTOMER_SERVICE_EVENT));
    window.location.assign(href);
  }, [closeMobileMenu]);

  const openMobileService = () => {
    setMobileOpen(false);
    setExpandedMobileItem(null);
    window.dispatchEvent(new CustomEvent(OPEN_CUSTOMER_SERVICE_EVENT));
  };

  const openSearch = useCallback(() => {
    setMobileOpen(false);
    setExpandedMobileItem(null);
    window.dispatchEvent(new CustomEvent(CLOSE_CUSTOMER_SERVICE_EVENT));
    setSearchOpen(true);
  }, []);

  const mobileMenuButton = (
    <button
      type="button"
      onClick={handleMobileMenuClick}
      onTouchEnd={handleMobileMenuTouchEnd}
      className="mobile-floating-action flex h-9 w-9 items-center justify-center rounded-full border border-white/70 bg-white/55 text-[#8B6A32] shadow-sm backdrop-blur-md transition-colors hover:bg-white"
      aria-label={mobileOpen ? '关闭导航菜单' : '打开导航菜单'}
      aria-expanded={mobileOpen}
    >
      {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
    </button>
  );

  const mobileUserButton = mobileStudent ? (
    <Link
      href="/dashboard/profile"
      onClick={(event) => navigateFromMobileMenu(event, '/dashboard/profile')}
      className="mobile-user-action relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white/70 bg-white/55 text-[#8B1A1A] shadow-sm backdrop-blur-md transition-colors hover:bg-white"
      aria-label="进入个人中心"
    >
      {mobileStudent.avatarUrl ? (
        <img
          src={mobileStudent.avatarUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          referrerPolicy="no-referrer"
          onError={(event) => event.currentTarget.remove()}
        />
      ) : (
        <User className="h-[18px] w-[18px]" />
      )}
    </Link>
  ) : (
    <button
      type="button"
      onClick={openMobileLogin}
      className="mobile-user-action flex h-9 w-9 items-center justify-center rounded-full border border-white/70 bg-white/55 text-[#8B1A1A] shadow-sm backdrop-blur-md transition-colors hover:bg-white"
      aria-label="打开登录窗口"
    >
      <User className="h-[18px] w-[18px]" />
    </button>
  );

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-[10060] px-3 pt-[calc(env(safe-area-inset-top)+0.5rem)] md:hidden">
        <div className="flex h-12 items-center justify-between rounded-2xl border border-white/55 bg-white/68 px-2.5 shadow-[0_10px_30px_rgba(44,24,16,0.12)] backdrop-blur-xl">
          <Link
            href="/"
            onClick={(event) => navigateFromMobileMenu(event, '/')}
            className="flex min-w-0 items-center gap-2"
            aria-label="伊娃东方舞首页"
          >
            <Image
              src="/logo-transparent-20261005.png"
              alt="伊娃东方舞"
              width={36}
              height={36}
              className="h-8 w-8 shrink-0 object-contain"
              priority
            />
            <span className="truncate font-serif text-[17px] font-bold text-[#3A2A1E]">伊娃东方舞</span>
          </Link>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={openSearch}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/70 bg-white/55 text-[#8B6A32] shadow-sm backdrop-blur-md"
              aria-label="打开全站搜索"
              aria-expanded={searchOpen}
            >
              <Search className="h-[18px] w-[18px]" />
            </button>
            <button
              type="button"
              onClick={openMobileService}
              className="mobile-floating-action flex h-9 w-9 items-center justify-center rounded-full border border-white/70 bg-white/55 text-[#8B1A1A] shadow-sm backdrop-blur-md"
              aria-label="打开客服信息"
            >
              <Headphones className="h-[18px] w-[18px]" />
            </button>
            {mobileMenuButton}
            {mobileUserButton}
          </div>
        </div>
      </header>

      <header
        className="fixed left-0 right-0 top-0 z-[9998] hidden bg-transparent md:block"
        data-navbar-tone={desktopNavbarTone}
      >
        <div className="mx-auto max-w-7xl px-2 lg:px-8">
          <div className="flex items-center justify-between h-14 md:h-16">
            {/* Logo */}
            <Link href="/" className="flex flex-shrink-0 items-center gap-2" aria-label="伊娃东方舞首页">
              <Image
                src="/logo-transparent-20261005.png" 
                alt="伊娃东方舞" 
                width={40}
                height={40}
                className="h-8 w-8 object-contain lg:h-10 lg:w-10"
                priority
              />
              <span className={cn(
                'hidden font-serif text-lg font-bold transition-colors lg:inline',
                usesLightDesktopText
                  ? 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]'
                  : 'text-[#2C1810]'
              )}>
                伊娃东方舞
              </span>
            </Link>

            {/* Desktop Nav - 带下拉菜单和角标 */}
            <nav className="hidden min-w-0 items-center gap-0 md:flex lg:gap-0.5">
              {navItems.map((item) => (
                <div key={item.label} className="relative group">
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-0.5 whitespace-nowrap rounded-lg px-1.5 py-2 text-xs font-medium transition-colors duration-200 lg:gap-1 lg:px-2.5 lg:text-sm',
                      pathname === item.href
                        ? usesLightDesktopText
                          ? 'bg-white/12 text-[#F3D28A] font-semibold drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]'
                          : 'bg-[#E8D5B7]/45 text-[#8B1A1A] font-semibold'
                        : usesLightDesktopText
                          ? 'text-white/90 hover:text-white hover:bg-white/10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]'
                          : 'text-[#4A3A2F] hover:text-[#8B1A1A] hover:bg-[#E8D5B7]/30'
                    )}
                  >
                    {item.label}
                    {/* 下拉箭头（如果需要二级菜单） */}
                    {item.children && <ChevronDown className="w-3 h-3" />}
                  </Link>
                  
                  {/* 下拉菜单（如果存在children） */}
                  {item.children && (
                    <div className="absolute top-full left-0 pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                      <div className="bg-[#1A1A1A]/60 backdrop-blur-xl rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.4)] border border-white/20 py-2 min-w-[180px]">
                        {item.children.map((child) => (
                          <Link
                            key={child.label}
                            href={child.href}
                            className="block px-4 py-2 text-sm text-white/80 hover:text-gold hover:bg-white/5 transition-colors"
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* 角标（新功能/热门） */}
                  {item.badge && (
                    <span className={cn(
                      'absolute -top-1 -right-1 px-1.5 py-0.5 text-xs rounded-full',
                      item.badge === 'NEW' ? 'bg-crimson text-white' : 'bg-gold text-white'
                    )}>
                      {item.badge}
                    </span>
                  )}
                </div>
              ))}
            </nav>

            {/* Desktop Right Actions - 搜索+控制台风格按钮 */}
            <div className="hidden flex-shrink-0 items-center gap-1 md:flex lg:gap-3">
              {/* 搜索按钮 */}
            <button
              type="button"
              onClick={() => searchOpen ? setSearchOpen(false) : openSearch()}
              className={cn(
                'rounded-lg p-2 transition-colors',
                usesLightDesktopText
                  ? 'text-white/90 hover:bg-white/10 hover:text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]'
                  : 'text-[#4A3A2F] hover:bg-[#E8D5B7]/30 hover:text-[#8B1A1A]'
              )}
              aria-label="打开全站搜索"
              aria-expanded={searchOpen}
            >
              <Search className="w-5 h-5" />
            </button>
              
              {mobileStudent ? (
                <div className="group relative flex items-center gap-2">
                  <Link
                    href="/dashboard/profile"
                    className={cn(
                      'flex max-w-[180px] items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                      usesLightDesktopText
                        ? 'border-white/30 text-white/95 hover:border-white/55 hover:text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]'
                        : 'border-[#B99652]/45 text-[#4A3A2F] hover:border-[#8B1A1A]/55 hover:text-[#8B1A1A]'
                    )}
                    aria-label="进入个人中心"
                  >
                    <span className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-crimson text-xs font-bold text-white">
                      {mobileStudent.name.slice(0, 1)}
                      {mobileStudent.avatarUrl ? (
                        <img
                          src={mobileStudent.avatarUrl}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                          referrerPolicy="no-referrer"
                          onError={(event) => event.currentTarget.remove()}
                        />
                      ) : null}
                    </span>
                    <span className="truncate">{mobileStudent.name}</span>
                    <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                  </Link>
                  <Link
                    href="/dashboard/messages"
                    className={cn(
                      'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors',
                      usesLightDesktopText
                        ? 'border-white/30 text-white/95 hover:border-white/55 hover:text-white'
                        : 'border-[#B99652]/45 text-[#8B1A1A] hover:border-[#8B1A1A]/55'
                    )}
                    aria-label={unreadMessageCount ? `我的消息，${unreadMessageCount}条未读` : '我的消息'}
                  >
                    <Bell className="h-4 w-4" />
                    {unreadMessageCount > 0 ? (
                      <span className="absolute -right-1.5 -top-1.5 min-w-4 rounded-full bg-[#E02020] px-1 text-center text-[10px] font-bold leading-4 text-white">
                        {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                      </span>
                    ) : null}
                  </Link>
                  <div className="invisible absolute right-0 top-full pt-2 opacity-0 transition-all group-hover:visible group-hover:opacity-100">
                    <div className="w-36 rounded-lg border border-white/20 bg-[#1A1A1A]/95 p-1.5 shadow-xl backdrop-blur-xl">
                      <Link href="/dashboard/profile" className="block rounded-md px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white">
                        个人中心
                      </Link>
                      <button
                        type="button"
                        onClick={handleMobileLogout}
                        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10 hover:text-white"
                      >
                        <LogOut className="h-4 w-4" />
                        退出登录
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setLoginOpen(true)}
                  className={cn(
                    'rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors lg:px-4 lg:text-sm',
                    usesLightDesktopText
                      ? 'border-white/30 text-white/95 hover:border-white/55 hover:text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]'
                      : 'border-[#B99652]/45 text-[#4A3A2F] hover:border-[#8B1A1A]/55 hover:text-[#8B1A1A]'
                  )}
                >
                  登录
                </button>
              )}
              
              {/* 控制台风格按钮（模仿科技平台的红色按钮） */}
              <button
                type="button"
                onClick={() => setLoginOpen(true)}
                className="hidden items-center gap-2 rounded-lg bg-gradient-to-r from-crimson to-crimson-dark px-5 py-2 text-sm font-medium text-white shadow-md transition-all duration-200 hover:shadow-lg hover:shadow-crimson/30 lg:flex"
              >
                <Sparkles className="w-4 h-4" />
                免费试听
              </button>
            </div>

            {/* Mobile Menu Button */}
          </div>
        </div>

      </header>

      {/* Mobile Compact Menu */}
      {mobileOpen && (
        <>
          <div
            role="button"
            tabIndex={-1}
            className="fixed inset-0 z-[10030] cursor-default bg-transparent md:hidden"
            aria-label="关闭导航菜单遮罩"
            onClick={() => {
              setMobileOpen(false);
              setExpandedMobileItem(null);
            }}
          />
          <nav
            className="fixed right-3 top-[calc(env(safe-area-inset-top)+4.5rem)] z-[10050] w-52 overflow-hidden rounded-2xl border border-[#E8DDCB] bg-white/96 p-1.5 text-[#2C1810] shadow-[0_18px_45px_rgba(44,24,16,0.18)] backdrop-blur-md md:hidden"
            aria-label="移动端导航菜单"
          >
            <div className="max-h-[58svh] overflow-y-auto">
              {mobileStudent ? (
                <div className="mb-1 rounded-xl border border-[#EFE6D8] bg-[#F8F3EA] px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Link
                      href="/dashboard/profile"
                      onClick={(event) => navigateFromMobileMenu(event, '/dashboard/profile')}
                      className="flex min-w-0 flex-1 items-center gap-2"
                      aria-label="进入个人中心"
                    >
                      <span className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#9F1D20] text-xs font-bold text-white">
                        {mobileStudent.name.slice(0, 1)}
                        {mobileStudent.avatarUrl ? (
                          <img
                            src={mobileStudent.avatarUrl}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover"
                            referrerPolicy="no-referrer"
                            onError={(event) => {
                              event.currentTarget.remove();
                            }}
                          />
                        ) : null}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-[#2C1810]">{mobileStudent.name}</div>
                        <div className="text-[11px] text-[#9A8A78]">已登录</div>
                      </div>
                    </Link>
                    <Link
                      href="/dashboard/messages"
                      onClick={(event) => navigateFromMobileMenu(event, '/dashboard/messages')}
                      className="mobile-student-message-link relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#9F1D20] transition hover:bg-white"
                      aria-label={unreadMessageCount ? `我的消息，${unreadMessageCount}条未读` : '我的消息'}
                    >
                      <Bell className="h-4 w-4" />
                      {unreadMessageCount > 0 ? (
                        <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-[#E02020] px-1 text-center text-[9px] font-bold leading-4 text-white">
                          {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                        </span>
                      ) : null}
                    </Link>
                  </div>
                </div>
              ) : null}

              {navItems.map((item) => {
                const isExpanded = expandedMobileItem === item.label;
                const isActive = pathname === item.href;

                return (
                  <div key={item.label} className="border-b border-[#EFE6D8] last:border-b-0">
                    {item.children ? (
                      <div
                        className={cn(
                          'flex items-center rounded-xl transition-colors',
                          isActive ? 'bg-[#F8F3EA] text-[#9F1D20]' : 'hover:bg-[#F8F3EA]'
                        )}
                      >
                        <Link
                          href={item.href}
                          onClick={(event) => navigateFromMobileMenu(event, item.href)}
                          className="flex min-h-10 flex-1 items-center px-3 py-2 text-sm font-semibold"
                        >
                          <span>{item.label}</span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => setExpandedMobileItem(isExpanded ? null : item.label)}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#B99652]"
                          aria-label={`${isExpanded ? '收起' : '展开'}${item.label}子菜单`}
                          aria-expanded={isExpanded}
                        >
                          <ChevronDown className={cn('h-4 w-4 transition-transform', isExpanded && 'rotate-180')} />
                        </button>
                      </div>
                    ) : (
                      <Link
                        href={item.href}
                        onClick={(event) => navigateFromMobileMenu(event, item.href)}
                        className={cn(
                          'flex items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold transition-colors',
                          isActive ? 'bg-[#F8F3EA] text-[#9F1D20]' : 'hover:bg-[#F8F3EA]'
                        )}
                      >
                        <span>{item.label}</span>
                        {item.badge && (
                          <span className={cn(
                            'ml-2 rounded-full px-1.5 py-0.5 text-[10px] text-white',
                            item.badge === 'NEW' ? 'bg-crimson' : 'bg-gold'
                          )}>
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    )}

                    {item.children && isExpanded && (
                      <div className="pb-1 pl-3 pr-1">
                        {item.children.map((child) => (
                          <Link
                            key={child.label}
                            href={child.href}
                            onClick={(event) => navigateFromMobileMenu(event, child.href)}
                            className="block rounded-lg px-3 py-1.5 text-xs font-medium text-[#7B6B5B] transition-colors hover:bg-[#F8F3EA] hover:text-[#9F1D20]"
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {mobileStudent && (
                <button
                  type="button"
                  onClick={handleMobileLogout}
                  className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl border border-[#E8DDCB] px-3 py-2 text-sm font-semibold text-[#9F1D20] transition-colors hover:bg-[#F8F3EA]"
                >
                  <LogOut className="h-4 w-4" />
                  <span>退出登录</span>
                </button>
              )}
            </div>
          </nav>
        </>
      )}
      <SiteSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <StudentLoginModal
        open={loginOpen}
        nextPath={pendingLoginNextRef.current || undefined}
        onClose={() => {
          pendingLoginNextRef.current = null;
          setLoginOpen(false);
        }}
        onSuccess={() => {
          const next = pendingLoginNextRef.current;
          setMobileStudent(readMobileStudent());
          pendingLoginNextRef.current = null;
          setLoginOpen(false);
          const destination = pwaLoginSuccessPath(next);
          if (destination) window.location.assign(destination);
        }}
      />
    </>
  );
}
