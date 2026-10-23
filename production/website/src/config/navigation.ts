// 导航配置 - V2版本（带下拉菜单和角标）
export interface NavItem {
  label: string;
  href: string;
  badge?: string; // NEW/HOT角标
  children?: NavItem[]; // 下拉菜单
}

export const navItems: NavItem[] = [
  { label: '首页', href: '/' },
  {
    label: '线上学院',
    href: '/courses',
  },
  {
    label: '线下培训',
    href: '/offline',
  },
  {
    label: '赛事平台',
    href: '/events',
  },
  {
    label: '品牌文化',
    href: '/about',
  },
  { label: '伊娃甄选', href: '/shop/selection' },
  { label: '师资认证', href: '/certification' },
  { label: '传承弟子', href: '/disciples' },
  { label: '东方舞圈', href: '/dance-circle' },
];

// 快捷卡片配置（模仿科技平台）
export const quickCards = [
  {
    id: 1,
    title: '限时免费试听',
    subtitle: '新学员专享福利',
    description: '点击领取平台千元资源礼包',
    icon: 'gift',
    href: '/enroll',
    bgGradient: 'from-gold to-gold-dark',
    tag: '限时优惠',
    tagColor: 'bg-crimson',
  },
  {
    id: 2,
    title: '2026夏季集训',
    subtitle: '火热报名中',
    description: '国际名师授课，限时特惠',
    icon: 'calendar',
    href: '/offline',
    bgGradient: 'from-crimson to-crimson-dark',
    tag: '仅剩15席',
    tagColor: 'bg-gold',
  },
  {
    id: 3,
    title: '师资认证体系',
    subtitle: '专业认证通道',
    description: '从学员到专业教师的成长之路',
    icon: 'award',
    href: '/certification',
    bgGradient: 'from-gold-dark to-crimson',
    tag: '官方认证',
    tagColor: 'bg-gold',
  },
  {
    id: 4,
    title: '《东方舞技巧大全》',
    subtitle: '权威教材发布',
    description: '伊娃老师编著，业界标杆',
    icon: 'book',
    href: '/shop/selection',
    bgGradient: 'from-crimson-dark to-gold-dark',
    tag: '新书热销',
    tagColor: 'bg-gold',
  },
];

// 悬浮工具栏配置
export const floatingToolbarItems = [
  { id: 'feedback', label: '满意度评价', icon: 'star', href: '#feedback' },
  { id: 'suggest', label: '建议反馈', icon: 'edit', href: '#suggest' },
  { id: 'follow', label: '关注我们', icon: 'heart', action: 'showQRCode' },
  { id: 'contact', label: '客服咨询', icon: 'headphones', href: '#contact' },
  { id: 'ai', label: 'AI助手', icon: 'robot', action: 'openAI', special: true },
];
