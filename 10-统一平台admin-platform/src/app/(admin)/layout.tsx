'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { App, Layout, Menu, Avatar, Dropdown, Space, Drawer, Grid } from 'antd';
import {
  HomeOutlined, UserOutlined, ShoppingCartOutlined,
  ShopOutlined, DollarOutlined, SettingOutlined, SafetyOutlined,
  LogoutOutlined, TeamOutlined, LaptopOutlined, CrownOutlined,
  GiftOutlined, CalendarOutlined, BarChartOutlined,
  PictureOutlined, AppstoreOutlined, FileTextOutlined, GlobalOutlined,
  FolderOutlined, TrophyOutlined, UserSwitchOutlined, NotificationOutlined,
  MoreOutlined,
} from '@ant-design/icons';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { platformLinks } from '@/lib/platform-links';
import { PwaInstallButton } from '@/components/pwa-install-button';
import { reportAdminAudit } from '@/lib/api';

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
      { key: '/offline-scheduling', icon: <CalendarOutlined />, label: '排课与约课' },
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
      { key: '/live', icon: <PictureOutlined />, label: '直播管理' },
    ],
  },
  {
    key: 'grp-extras',
    type: 'group',
    label: '扩展',
    children: [
      { key: '/content', icon: <FileTextOutlined />, label: '内容管理' },
      { key: '/miniprogram', icon: <AppstoreOutlined />, label: '小程序' },
      { key: '/data', icon: <BarChartOutlined />, label: '数据分析' },
      { key: '/crm', icon: <TeamOutlined />, label: 'CRM' },
    ],
  },
  {
    key: 'grp-more',
    type: 'group',
    label: '更多',
    children: [
      { key: '/order-center', icon: <ShoppingCartOutlined />, label: '收银台' },
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
  const { user, logout } = useAuth();
  const { message } = App.useApp();
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // 找到当前激活的菜单项
  const active = useMemo(() => {
    const allKeys = searchableItems.map(s => s.key);
    return allKeys
      .filter((k: string) => pathname === k || pathname?.startsWith(`${k}/`))
      .sort((a: string, b: string) => b.length - a.length)[0] || '/dashboard';
  }, [pathname]);

  // 更新页面标题
  useEffect(() => {
    const label = pathLabelMap[active] || '首页总览';
    if (typeof document !== 'undefined') {
      document.title = `${label} · 伊娃东方舞`;
    }
  }, [active]);

  useEffect(() => {
    if (!user || !pathname) return;
    reportAdminAudit({ kind: 'access', path: pathname, method: 'GET', status: 200, label: pathLabelMap[active] || '后台页面' });
  }, [active, pathname, user]);

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
      onClick: () => router.push('/miniprogram'),
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
      items={menuItems}
      onClick={({ key }) => {
        if (key.startsWith('/')) {
          router.push(key);
          setMobileMenuOpen(false);
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
                  src="/apple-touch-icon.png"
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
        placement="left"
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        width="min(88vw, 340px)"
        styles={{
          body: { padding: 0, background: '#07172D' },
          header: { display: 'none' },
        }}
      >
        <div className="sider-brand" style={{ minHeight: '100vh', paddingTop: 8, display: 'flex', flexDirection: 'column' }}>
          <div className="admin-mobile-drawer-brand">
            <img src="/pwa-icon-192.png" alt="" />
            <div><strong>伊娃东方舞</strong><span>数字化运营平台</span></div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {menu}
          </div>
          <div style={{ flexShrink: 0, padding: '10px 12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <PwaInstallButton />
            {userProfile(false)}
          </div>
        </div>
      </Drawer>

      {/* ===== 右侧内容区 ===== */}
      <Layout className="admin-main-layout">
        <Content style={{
          padding: isMobile
            ? 'max(10px, env(safe-area-inset-top)) 10px calc(82px + env(safe-area-inset-bottom))'
            : 24,
          background: '#f0f2f5',
          minHeight: '100vh',
        }} className="admin-content">
          {children}
        </Content>

        {isMobile && (
          <nav className="admin-mobile-tabbar" aria-label="常用功能">
            {mobilePrimaryItems.map(item => {
              const selected = active === item.key;
              return (
                <button key={item.key} type="button" className={selected ? 'is-active' : ''} onClick={() => router.push(item.key)} aria-current={selected ? 'page' : undefined}>
                  {item.icon}<span>{item.label}</span>
                </button>
              );
            })}
            <button type="button" className={mobilePrimaryItems.some(item => item.key === active) ? '' : 'is-active'} onClick={() => setMobileMenuOpen(true)}>
              <MoreOutlined /><span>全部</span>
            </button>
          </nav>
        )}
      </Layout>
    </Layout>
  );
}
