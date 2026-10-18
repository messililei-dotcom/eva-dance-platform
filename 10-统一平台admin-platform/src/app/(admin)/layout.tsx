'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { App, Layout, Menu, Avatar, Dropdown, Space, Drawer, Grid, Result, Input, Button, Empty } from 'antd';
import {
  HomeOutlined, UserOutlined, ShoppingCartOutlined,
  ShopOutlined, DollarOutlined, SettingOutlined, SafetyOutlined,
  LogoutOutlined, TeamOutlined, LaptopOutlined, CrownOutlined,
  GiftOutlined, CalendarOutlined,
  AppstoreOutlined, GlobalOutlined,
  FolderOutlined, TrophyOutlined, UserSwitchOutlined, NotificationOutlined,
  MoreOutlined, SearchOutlined, ArrowLeftOutlined, CloseOutlined,
} from '@ant-design/icons';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { platformLinks } from '@/lib/platform-links';
import { PwaInstallButton } from '@/components/pwa-install-button';
import { reportAdminAudit } from '@/lib/api';
import { adminLandingPage, canAccessAdminPage } from '@/lib/admin-feature-access';
import '@/styles/admin-mobile.css';

const { Sider, Content } = Layout;
const { useBreakpoint } = Grid;

// ========== 完整导航菜单 ==========
const menuItems: any[] = [
  {
    key: 'grp-core',
    type: 'group',
    label: '核心',
    children: [
      { key: '/dashboard', icon: <HomeOutlined />, label: '首页总览' },
      { key: '/members', icon: <UserOutlined />, label: '学员信息' },
      { key: '/orders', icon: <ShoppingCartOutlined />, label: '订单中心' },
      { key: '/student-growth', icon: <TrophyOutlined />, label: '成长体系' },
      { key: '/access-records', icon: <GlobalOutlined />, label: '访问记录' },
    ],
  },
  {
    key: 'grp-education',
    type: 'group',
    label: '教学',
    children: [
      { key: '/training', icon: <TeamOutlined />, label: '线下课程' },
      { key: '/online-course', icon: <LaptopOutlined />, label: '线上课程' },
      { key: '/online-course/materials', icon: <FolderOutlined />, label: '素材中心' },
      { key: '/online-course/auth', icon: <UserSwitchOutlined />, label: '学员授权' },
      { key: '/certificates', icon: <CrownOutlined />, label: '证书管理' },
      { key: '/events', icon: <CalendarOutlined />, label: '赛事管理' },
    ],
  },
  {
    key: 'grp-business',
    type: 'group',
    label: '业务',
    children: [
      { key: '/ecommerce', icon: <ShopOutlined />, label: '电商系统' },
      { key: '/bonus-commission', icon: <TrophyOutlined />, label: '奖金提成' },
      { key: '/finance', icon: <DollarOutlined />, label: '财务中心' },
      { key: '/marketing', icon: <GiftOutlined />, label: '营销工具' },
      { key: '/messages', icon: <NotificationOutlined />, label: '站内消息' },
    ],
  },
  { type: 'divider' as const },
  {
    key: 'grp-system',
    type: 'group',
    label: '系统',
    children: [
      { key: '/permissions', icon: <SafetyOutlined />, label: '权限管理' },
      { key: '/settings', icon: <SettingOutlined />, label: '系统设置' },
    ],
  },
];

// 路由 → 标签映射
const pathLabelMap: Record<string, string> = {};

function flattenItems(items: any[]) {
  for (const item of items) {
    if (item.key) pathLabelMap[item.key] = item.label;
    if (item.children) {
      flattenItems(item.children);
    }
  }
}
flattenItems(menuItems);
pathLabelMap['/miniprogram'] = '小程序配置';

// 所有可搜索的路由
const searchableItems = menuItems.flatMap((it: any) =>
  it.children ? it.children.map((c: any) => ({ label: c.label, key: c.key, icon: c.icon })) : []
);
const mobilePrimaryItems = [
  { key: '/online-course', label: '线上课', icon: <LaptopOutlined /> },
  { key: '/training', label: '线下课', icon: <TeamOutlined /> },
  { key: '/online-course/auth', label: '授权', icon: <UserSwitchOutlined /> },
  { key: '/ecommerce', label: '电商', icon: <ShopOutlined /> },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, loading } = useAuth();
  const eventOnly = user?.role === 'event_admin';
  const canView = canAccessAdminPage(user, pathname || '/');
  const landingPage = adminLandingPage(user);
  const visibleMenuItems = menuItems.flatMap(item => {
    if (!item.children) return [];
    const children = item.children.filter((child: { key: string }) => canAccessAdminPage(user, child.key));
    return children.length ? [{ ...item, children }] : [];
  });
  const { message } = App.useApp();
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [menuSearch, setMenuSearch] = useState('');
  const [recentPaths, setRecentPaths] = useState<string[]>([]);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const visibleRecentPaths = recentPaths.filter(path => canAccessAdminPage(user, path));
  const recentStorageKey = user?.id || user?.username
    ? `admin-mobile-recent:${user?.id || user?.username}` : null;
  const primaryItems = eventOnly
    ? [{ key: '/events', label: '赛事', icon: <CalendarOutlined /> }] : mobilePrimaryItems;

  useEffect(() => {
    if (!recentStorageKey) { setRecentPaths([]); return; }
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(recentStorageKey) || '[]');
      setRecentPaths(Array.isArray(saved) ? saved.filter((key): key is string =>
        typeof key === 'string' && searchableItems.some(item => item.key === key)).slice(0, 4) : []);
    } catch { setRecentPaths([]); }
  }, [recentStorageKey]);

  useEffect(() => {
    if (!isMobile) return;
    const viewport = window.visualViewport;
    const update = () => {
      const field = document.activeElement;
      const editing = field instanceof HTMLElement &&
        (field.matches('input, textarea, select') || field.isContentEditable);
      setKeyboardOpen(Boolean(editing && viewport && window.innerHeight - viewport.height > 150));
    };
    update();
    viewport?.addEventListener('resize', update);
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    return () => {
      viewport?.removeEventListener('resize', update);
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', update);
    };
  }, [isMobile]);

  useEffect(() => {
    setMobileMenuOpen(false);
    setMenuSearch('');
  }, [pathname]);

  const navigate = (key: string) => {
    if (!canAccessAdminPage(user, key)) return;
    if (recentStorageKey) {
      setRecentPaths(previous => {
        const next = [key, ...previous.filter(path => path !== key)].slice(0, 4);
        try { localStorage.setItem(recentStorageKey, JSON.stringify(next)); } catch { /* Storage may be unavailable. */ }
        return next;
      });
    }
    router.push(key);
    setMobileMenuOpen(false);
    setMenuSearch('');
  };

  const mobileGroups = visibleMenuItems.filter(item => item.children).map(group => ({
    ...group,
    children: group.children.filter((item: any) =>
      (!menuSearch.trim() ||
        `${item.label} ${group.label} ${item.key === '/bonus-commission' ? '工资 报销 课时 商品提成' : ''}`.includes(menuSearch.trim())))
  })).filter(group => group.children.length);


  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  // 找到当前激活的菜单项
  const active = useMemo(() => {
    const allKeys = [...searchableItems.map(s => s.key), '/miniprogram'];
    return allKeys
      .filter((k: string) => pathname === k || pathname?.startsWith(`${k}/`))
      .sort((a: string, b: string) => b.length - a.length)[0] || landingPage;
  }, [pathname, landingPage]);

  // 更新页面标题
  useEffect(() => {
    const label = pathLabelMap[active] || '首页总览';
    if (typeof document !== 'undefined') {
      document.title = `${label} · 伊娃东方舞`;
    }
  }, [active]);

  useEffect(() => {
    if (!user || !pathname || !canView) return;
    reportAdminAudit({ kind: 'access', path: pathname, method: 'GET', status: 200, label: pathLabelMap[active] || '后台页面' });
  }, [active, pathname, user, canView]);

  // 用户信息
  const rawUserName = user?.name || user?.username || '管理员';
  const userName = rawUserName === '李磊' ? '李雷' : rawUserName;
  const userRole = user?.role || user?.roles?.[0] || '管理员';
  const userInitials = userName[0]?.toUpperCase() || 'A';

  // 退出登录
  const handleLogout = async () => {
    try {
      await logout();
      message.success('已退出登录');
      router.push('/login');
    } catch {
      message.error('退出失败');
    }
  };

  // 下拉菜单
  const userMenuItems = [
    {
      key: 'website',
      icon: <GlobalOutlined />,
      label: <a href={platformLinks.website.home} target="_blank" rel="noreferrer">打开品牌官网</a>,
    },
    {
      key: 'miniapp',
      icon: <AppstoreOutlined />,
      label: '小程序配置',
      onClick: () => navigate('/miniprogram'),
      disabled: !canAccessAdminPage(user, '/miniprogram'),
    },
    { type: 'divider' as const },
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人设置',
    },
    { type: 'divider' as const },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true,
      onClick: handleLogout,
    },
  ];

  const menu = (
    <Menu
      mode="inline"
      theme="dark"
      selectedKeys={[active]}
      defaultOpenKeys={isMobile ? ['grp-core', 'grp-education'] : ['grp-core']}
      items={visibleMenuItems}
      onClick={({ key }) => {
        if (key.startsWith('/')) {
          navigate(key);
        }
      }}
      style={{
        background: 'transparent',
        borderRight: 'none',
        paddingTop: 4,
        fontSize: 13,
      }}
    />
  );

  const userProfile = (compact = false) => (
    <Dropdown menu={{ items: userMenuItems }} trigger={['click']} placement="topLeft">
      <Space
        style={{
          width: '100%',
          height: compact ? 36 : 42,
          cursor: 'pointer',
          padding: compact ? '0' : '0 10px',
          borderRadius: 8,
          justifyContent: compact ? 'center' : 'flex-start',
          transition: 'background 0.2s',
        }}
        className="user-trigger"
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <Avatar
          style={{
            background: 'linear-gradient(135deg, #F72A8A, #7C3AED)',
            verticalAlign: 'middle',
            fontSize: compact ? 12 : 14,
            fontWeight: 600,
            flexShrink: 0,
          }}
          size={compact ? 28 : 30}
        >
          {userInitials}
        </Avatar>
        {!compact && (
          <div style={{ lineHeight: 1.2, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {userName}
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.62)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {userRole}
            </div>
          </div>
        )}
      </Space>
    </Dropdown>
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* ===== 左侧边栏 ===== */}
      {!isMobile && (
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          theme="dark"
          width={220}
          className="sider-brand"
          style={{
            background: 'linear-gradient(180deg, #07172D 0%, #180B3A 100%)',
            borderRight: '1px solid rgba(255,255,255,0.06)',
            overflow: 'hidden',
            height: '100vh',
            position: 'sticky',
            top: 0,
            left: 0,
          }}
        >
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', paddingBottom: 28 }}>
            {/* Logo */}
            <div style={{
              height: 64,
              display: 'flex',
              alignItems: 'center',
              padding: '0 16px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              justifyContent: collapsed ? 'center' : 'flex-start',
              flexShrink: 0,
            }}>
              <div style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                overflow: 'hidden',
              }}>
                <img
                  src="/apple-touch-icon-20261005.png"
                  alt="伊娃东方舞"
                  style={{
                    width: 30,
                    height: 30,
                    objectFit: 'contain',
                    display: 'block',
                  }}
                />
              </div>
              {!collapsed && (
                <div style={{ marginLeft: 10, flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', color: '#fff', lineHeight: 1.2 }}>
                    伊娃东方舞
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>
                    数字化运营平台
                  </div>
                </div>
              )}
            </div>

            {/* 菜单 */}
            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
              {menu}
            </div>

            {/* 底部用户信息 */}
            <div style={{
              flexShrink: 0,
              height: 64,
              padding: collapsed ? '0 12px' : '0 10px',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {userProfile(collapsed)}
            </div>
          </div>
        </Sider>
      )}

      <Drawer
        title="全部功能"
        placement="bottom"
        open={isMobile && mobileMenuOpen}
        onClose={() => { setMobileMenuOpen(false); setMenuSearch(''); }}
        height="min(86dvh, 760px)"
        className="admin-mobile-functions"
        closeIcon={<CloseOutlined aria-label="关闭全部功能" />}
        styles={{ body: { padding: 0 }, header: { padding: '12px 16px' } }}
      >
        <div className="admin-mobile-function-search">
          <Input prefix={<SearchOutlined />} placeholder="搜索功能，如订单、授权、工资"
            aria-label="搜索管理功能" allowClear value={menuSearch}
            onChange={event => setMenuSearch(event.target.value)} />
        </div>
        <div className="admin-mobile-function-body">
          {!menuSearch.trim() && visibleRecentPaths.length > 0 && (
            <section aria-label="最近使用" className="admin-mobile-function-group">
              <h3>最近使用</h3>
              <div className="admin-mobile-recent">
                {visibleRecentPaths.map(key => (
                  <button type="button" key={key} onClick={() => navigate(key)}>{pathLabelMap[key]}</button>
                ))}
              </div>
            </section>
          )}
          {mobileGroups.map(group => (
            <section key={group.key} aria-label={group.label} className="admin-mobile-function-group">
              <h3>{group.label}</h3>
              <div className="admin-mobile-function-grid">
                {group.children.map((item: any) => (
                  <button key={item.key} type="button" onClick={() => navigate(item.key)}
                    className={active === item.key ? 'is-active' : ''} aria-current={active === item.key ? 'page' : undefined}>
                    {item.icon}<span>{item.label}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
          {!mobileGroups.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有找到功能，请换个关键词" />}
          <div className="admin-mobile-function-account">
            <Dropdown menu={{ items: userMenuItems }} trigger={['click']}>
              <button type="button" className="admin-mobile-account-trigger" aria-label="账户菜单">
                <Avatar size={32}>{userInitials}</Avatar><span>{userName}</span><MoreOutlined />
              </button>
            </Dropdown>
            <Button icon={<LogoutOutlined />} onClick={handleLogout}>退出登录</Button>
          </div>
          <PwaInstallButton />
        </div>
      </Drawer>

      {/* ===== 右侧内容区 ===== */}
      <Layout className={`admin-main-layout${keyboardOpen ? ' is-keyboard-open' : ''}`}>
        {isMobile && (
          <header className="admin-mobile-header">
            <Button type="text" icon={pathname !== active ? <ArrowLeftOutlined /> : <HomeOutlined />}
              aria-label={pathname !== active ? '返回列表' : pathLabelMap[landingPage]}
              onClick={() => navigate(pathname !== active ? active : landingPage)} />
            <div className="admin-mobile-title"><strong>{pathLabelMap[active] || '管理工作台'}</strong><span>伊娃东方舞 · {userName}</span></div>
            <Button type="text" icon={<AppstoreOutlined />} aria-label="打开全部功能"
              aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen(true)} />
          </header>
        )}
        <Content style={{
          padding: isMobile
            ? '12px 12px calc(88px + env(safe-area-inset-bottom))'
            : 24,
          background: '#f0f2f5',
          minHeight: '100vh',
        }} className="admin-content">
          {loading ? null : canView ? children : <Result status="403" title="无权限查看" subTitle={eventOnly ? "此账号仅可使用赛事管理，管理自己新建的赛事。" : "当前账号没有此功能的访问权限。"} />}
        </Content>

        {isMobile && (
          <nav className="admin-mobile-tabbar" aria-label="常用功能" style={{ gridTemplateColumns: `repeat(${primaryItems.length + 1}, minmax(0, 1fr))` }}>
            {primaryItems.map(item => {
              const selected = active === item.key;
              return (
                <button key={item.key} type="button" className={selected ? 'is-active' : ''} onClick={() => navigate(item.key)} aria-current={selected ? 'page' : undefined}>
                  {item.icon}<span>{item.label}</span>
                </button>
              );
            })}
            <button type="button" className={!primaryItems.some(item => item.key === active) || mobileMenuOpen ? 'is-active' : ''} aria-label="打开全部功能" aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen(true)}>
              <MoreOutlined /><span>全部</span>
            </button>
          </nav>
        )}
      </Layout>
    </Layout>
  );
}
