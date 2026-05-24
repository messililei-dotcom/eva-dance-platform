'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { Layout, Menu, Avatar, Dropdown, Badge, Button, Space, Input, Typography, Tooltip, AutoComplete, message } from 'antd';
import {
  HomeOutlined, UserOutlined, ShoppingCartOutlined,
  ShopOutlined, DollarOutlined, SettingOutlined, SafetyOutlined,
  BellOutlined, MenuFoldOutlined, MenuUnfoldOutlined, SearchOutlined,
  LogoutOutlined, TeamOutlined, LaptopOutlined, CrownOutlined,
  BookOutlined, GiftOutlined, CalendarOutlined, BarChartOutlined,
  PictureOutlined, AppstoreOutlined, FileTextOutlined, GlobalOutlined,
} from '@ant-design/icons';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { platformLinks } from '@/lib/platform-links';

const { Sider, Content, Header } = Layout;
const { Text } = Typography;

// ========== 完整导航菜单 ==========
const menuItems: any[] = [
  {
    key: 'grp-core',
    type: 'group',
    label: '核心',
    children: [
      { key: '/dashboard', icon: <HomeOutlined />, label: '首页总览' },
      { key: '/members', icon: <UserOutlined />, label: '学员中心' },
      { key: '/orders', icon: <ShoppingCartOutlined />, label: '订单中心' },
      { key: '/student-progress', icon: <BarChartOutlined />, label: '学员进度' },
    ],
  },
  {
    key: 'grp-education',
    type: 'group',
    label: '教学',
    children: [
      { key: '/courses', icon: <BookOutlined />, label: '课程管理' },
      { key: '/training', icon: <TeamOutlined />, label: '线下培训' },
      { key: '/online-course', icon: <LaptopOutlined />, label: '网课系统' },
      { key: '/certificates', icon: <CrownOutlined />, label: '证书管理' },
      { key: '/events', icon: <CalendarOutlined />, label: '活动管理' },
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
      { key: '/masterclass', icon: <CrownOutlined />, label: '大师课' },
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

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const [collapsed, setCollapsed] = useState(false);
  const [searchOptions, setSearchOptions] = useState<{ value: string; label: string; key: string }[]>([]);
  const [pageTitle, setPageTitle] = useState('首页总览');

  // 找到当前激活的菜单项
  const active = useMemo(() => {
    const allKeys = searchableItems.map(s => s.key);
    return allKeys.find((k: string) => pathname?.startsWith(k)) || '/dashboard';
  }, [pathname]);

  // 更新页面标题
  useEffect(() => {
    const label = pathLabelMap[active] || '首页总览';
    setPageTitle(label);
    if (typeof document !== 'undefined') {
      document.title = `${label} · 伊娃东方舞`;
    }
  }, [active]);

  // 搜索功能
  const handleSearch = (value: string) => {
    if (!value) {
      setSearchOptions([]);
      return;
    }
    const filtered = searchableItems
      .filter(item => item.label.includes(value) || item.key.includes(value))
      .map(item => ({ value: item.key, label: item.label, key: item.key }));
    setSearchOptions(filtered);
  };

  const handleSearchSelect = (value: string | undefined) => {
    if (value && value.startsWith('/')) {
      router.push(value);
      setSearchOptions([]);
    }
  };

  // 用户信息
  const userName = user?.name || user?.username || '管理员';
  const userAvatar = user?.name?.[0] || user?.username?.[0] || 'A';
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
      key: 'learn',
      icon: <BookOutlined />,
      label: <a href={platformLinks.learn.home} target="_blank" rel="noreferrer">打开学员中心</a>,
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

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* ===== 左侧边栏 ===== */}
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
          overflow: 'auto',
          height: '100vh',
          position: 'sticky',
          top: 0,
          left: 0,
        }}
      >
        {/* Logo */}
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          justifyContent: collapsed ? 'center' : 'flex-start',
        }}>
          <div style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #F72A8A, #7C3AED)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: 15,
            flexShrink: 0,
            boxShadow: '0 10px 24px rgba(247,42,138,0.22)',
          }}>
            E
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
        <Menu
          mode="inline"
          theme="dark"
          selectedKeys={[active]}
          defaultOpenKeys={['grp-core']}
          items={menuItems}
          onClick={({ key }) => {
            if (key.startsWith('/')) router.push(key);
          }}
          style={{
            background: 'transparent',
            borderRight: 'none',
            paddingTop: 4,
            fontSize: 13,
          }}
        />

        {/* 底部版本信息 */}
        {!collapsed && (
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '12px 16px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            textAlign: 'center',
            color: 'rgba(255,255,255,0.3)',
            fontSize: 11,
          }}>
            v1.0.0
          </div>
        )}
      </Sider>

      {/* ===== 右侧内容区 ===== */}
      <Layout>
        <Header style={{
          padding: '0 24px',
          background: '#fff',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 56,
          position: 'sticky',
          top: 0,
          zIndex: 10,
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        }}>
          {/* 左侧：折叠按钮 + 面包屑/标题 */}
          <Space>
            <Tooltip title={collapsed ? '展开侧栏' : '收起侧栏'}>
              <Button
                type="text"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setCollapsed(!collapsed)}
                style={{ color: '#666' }}
              />
            </Tooltip>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#1f2937' }}>
              {pageTitle}
            </span>
          </Space>

          {/* 右侧：搜索 + 通知 + 用户 */}
          <Space size="middle" wrap={false}>
            {/* 搜索框（带自动补全） */}
            <AutoComplete
              options={searchOptions}
              onSearch={handleSearch}
              onSelect={handleSearchSelect}
              value={undefined}
              style={{ width: 220 }}
              notFoundContent={null}
            >
              <Input
                placeholder="搜索菜单..."
                prefix={<SearchOutlined style={{ color: '#999' }} />}
                style={{ borderRadius: 6, height: 34, background: '#f5f5f5', border: '1px solid #e8e8e8' }}
                size="small"
                allowClear
              />
            </AutoComplete>

            {/* 通知 */}
            <Tooltip title="品牌官网">
              <Button
                type="text"
                icon={<GlobalOutlined />}
                href={platformLinks.website.home}
                target="_blank"
                style={{ color: '#666' }}
              />
            </Tooltip>
            <Tooltip title="学员中心">
              <Button
                type="text"
                icon={<BookOutlined />}
                href={platformLinks.learn.home}
                target="_blank"
                style={{ color: '#666' }}
              />
            </Tooltip>

            {/* 通知 */}
            <Tooltip title="通知">
              <Badge count={0} size="small" offset={[-2, 2]}>
                <BellOutlined style={{ fontSize: 18, cursor: 'pointer', color: '#666' }} />
              </Badge>
            </Tooltip>

            {/* 用户信息 */}
            <Dropdown menu={{ items: userMenuItems }} trigger={['click']}>
              <Space style={{ cursor: 'pointer', padding: '4px 8px', borderRadius: 8, transition: 'background 0.2s' }}
                className="user-trigger"
                onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <Avatar
                  style={{
                    background: 'linear-gradient(135deg, #F72A8A, #7C3AED)',
                    verticalAlign: 'middle',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                  size={30}
                >
                  {userInitials}
                </Avatar>
                <div style={{ lineHeight: 1.2 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1f2937' }}>{userName}</div>
                  <div style={{ fontSize: 11, color: '#999' }}>{userRole}</div>
                </div>
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Content style={{
          padding: 24,
          background: '#f0f2f5',
          minHeight: 'calc(100vh - 56px)',
        }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
