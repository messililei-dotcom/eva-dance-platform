'use client';

import { BookOutlined, HomeOutlined, MenuOutlined } from '@ant-design/icons';
import { Button, Dropdown, Space } from 'antd';
import { platformLinks } from '@/lib/platform-links';

const navItems = [
  { label: '首页', href: platformLinks.website.home },
  { label: '线上学院', href: '/learn' },
  { label: '线上课程', href: '/learn/courses' },
  { label: '线下培训', href: `${platformLinks.website.origin}/offline` },
  { label: '赛事平台', href: `${platformLinks.website.origin}/festival` },
  { label: '品牌文化', href: `${platformLinks.website.origin}/about` },
  { label: '师资认证', href: `${platformLinks.website.origin}/certification` },
  { label: '传承弟子', href: `${platformLinks.website.origin}/disciples` },
];

export default function OfficialWebsiteNav() {
  return (
    <header
      className="learn-official-nav"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        margin: '-28px calc(clamp(16px, 4vw, 42px) * -1) 24px',
        borderBottom: '1px solid rgba(232,221,203,0.86)',
        background: 'rgba(255,253,248,0.96)',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 10px 26px rgba(44,24,16,0.06)',
      }}
    >
      <div
        style={{
          minHeight: 68,
          padding: '0 clamp(16px, 4vw, 42px)',
          display: 'flex',
          alignItems: 'center',
          gap: 22,
        }}
      >
        <a href={platformLinks.website.home} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              display: 'grid',
              placeItems: 'center',
              color: '#fff',
              fontWeight: 900,
              background: 'linear-gradient(135deg,var(--learn-gold),var(--learn-red))',
              boxShadow: '0 8px 18px rgba(139,26,26,0.18)',
            }}
          >
            E
          </div>
          <div>
            <div style={{ color: 'var(--learn-text)', fontSize: 17, fontWeight: 900, lineHeight: 1.1 }}>伊娃东方舞</div>
            <div style={{ color: 'var(--learn-muted)', fontSize: 11, letterSpacing: 1 }}>AIWA RAKS</div>
          </div>
        </a>

        <nav className="learn-official-nav-links" style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 }}>
          {navItems.map(item => (
            <a
              key={item.label}
              href={item.href}
              style={{
                height: 38,
                display: 'inline-flex',
                alignItems: 'center',
                padding: '0 11px',
                borderRadius: 6,
                color: item.href === '/learn/courses' ? 'var(--learn-red)' : 'var(--learn-text)',
                fontSize: 14,
                fontWeight: 800,
                whiteSpace: 'nowrap',
                textDecoration: 'none',
              }}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <Space className="learn-official-nav-actions" size={10}>
          <Button href="/learn" icon={<HomeOutlined />} style={{ borderRadius: 6 }}>学习中心</Button>
          <Button type="primary" href="/learn/courses" icon={<BookOutlined />} style={{ borderRadius: 6 }}>我的课程</Button>
          <Dropdown
            menu={{ items: navItems.map(item => ({ key: item.label, label: <a href={item.href}>{item.label}</a> })) }}
            trigger={['click']}
          >
            <Button className="learn-official-nav-menu" icon={<MenuOutlined />} style={{ display: 'none', borderRadius: 6 }} aria-label="打开官网导航" />
          </Dropdown>
        </Space>
      </div>
    </header>
  );
}
