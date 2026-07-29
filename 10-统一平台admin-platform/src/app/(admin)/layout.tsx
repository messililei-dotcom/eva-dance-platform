'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { App, Layout, Menu, Avatar, Dropdown, Button, Space, Drawer, Grid } from 'antd';
import {
  HomeOutlined, UserOutlined, ShoppingCartOutlined,
  ShopOutlined, DollarOutlined, SettingOutlined, SafetyOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined, TeamOutlined, LaptopOutlined, CrownOutlined,
  GiftOutlined, CalendarOutlined, BarChartOutlined,
  PictureOutlined, AppstoreOutlined, FileTextOutlined, GlobalOutlined,
  FolderOutlined, UserSwitchOutlined,
  NotificationOutlined,
} from '@ant-design/icons';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { platformLinks } from '@/lib/platform-links';

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
      { key: '/student-progress', icon: <BarChartOutlined />, label: '学员进度' },
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
const pathGroupMap: Record<string, string> = {};

function flattenItems(items: any[], parentGroup?: string) {
  for (const item of items) {
    if (item.key) pathLabelMap[item.key] = item.label;
    if (item.children) {
      // If this is a group type, pass group label to children
      const groupLabel = item.type === 'group' ? item.label : parentGroup;
      flattenItems(item.children, groupLabel);
    }
  }
}
flattenItems(menuItems);

// Build group map from the nested structure
for (const item of menuItems) {
  if (item.children) {
    item.children.forEach((c: any) => {
      if (c.key) pathGroupMap[c.key] = item.label;
    });
  }
}

// 所有可搜索的路由
const searchableItems = menuItems.flatMap((it: any) =>
  it.children ? it.children.map((c: any) => ({ label: c.label, key: c.key, icon: c.icon })) : []
);
const MOBILE_HIDDEN_MENU_KEYS = new Set(['/dashboard', '/members', '/orders', '/student-progress', '/certificates', '/events', '/live']);

function filterMobileMenuItems(items: any[]) {
  return items
    .filter(item => item.key !== 'grp-core' && item.key !== 'grp-extras')
    .map(item => {
      if (!item.children) return item;
      const children = item.children.filter((child: any) => !MOBILE_HIDDEN_MENU_KEYS.has(child.key));
      return { ...item, children };
    })
    .filter(item => !item.children || item.children.length > 0);
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { message } = App.useApp();
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const shouldRedirectMobileDashboard = pathname === '/dashboard' && isMobile;
  const visibleMenuItems = useMemo(() => (
    isMobile ? filterMobileMenuItems(menuItems) : menuItems
  ), [isMobile]);

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
    if (pathname !== '/dashboard') return;
    if (isMobile) {
      router.replace('/training');
    }
  }, [isMobile, pathname, router]);

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
      defaultOpenKeys={isMobile ? ['grp-education'] : ['grp-core']}
      items={visibleMenuItems}
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
          height: compact ? 28 : 28,
          cursor: 'pointer',
          padding: compact ? '0' : '0 6px',
          borderRadius: 6,
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
            fontSize: compact ? 11 : 12,
            fontWeight: 600,
            flexShrink: 0,
          }}
          size={compact ? 22 : 22}
        >
          {userInitials}
        </Avatar>
        {!compact && (
          <div style={{ lineHeight: 1.05, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {userName}
            </div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
              height: 50,
              padding: collapsed ? '0 12px' : '0 8px',
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
        width={280}
        styles={{
          body: { padding: 0, background: '#07172D' },
          header: { display: 'none' },
        }}
      >
        <div className="sider-brand" style={{ minHeight: '100vh', paddingTop: 8, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '14px 18px', color: '#fff', fontWeight: 700, flexShrink: 0 }}>伊娃东方舞</div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {menu}
          </div>
          <div style={{ flexShrink: 0, padding: '10px 12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            {userProfile(false)}
          </div>
        </div>
      </Drawer>

      {/* ===== 右侧内容区 ===== */}
      <Layout className="admin-main-layout">
        {isMobile && (
          <div className="admin-mobile-header">
            <div className="admin-mobile-title">
              <strong>{pathLabelMap[active] || '首页总览'}</strong>
              <span>{pathGroupMap[active] || '后台管理'}</span>
            </div>
            <Button
              className="admin-mobile-menu-button"
              type="primary"
              shape="circle"
              icon={<MenuUnfoldOutlined />}
              onClick={() => setMobileMenuOpen(true)}
              aria-label="打开菜单"
            />
          </div>
        )}

        <Content style={{
          padding: isMobile ? 12 : 24,
          background: '#f0f2f5',
          minHeight: '100vh',
        }}>
          {shouldRedirectMobileDashboard ? null : children}
        </Content>
      </Layout>
    </Layout>
  );
}
