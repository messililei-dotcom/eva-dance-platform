// 导航配置 - V2版本（带下拉菜单和角标）
export const navItems = [
  { label: '首页', href: '/' },
  {
    label: '线上学院',
    href: '/courses',
    badge: 'NEW',
  },
  { label: '线下集训', href: '/offline', badge: 'HOT' },
  { label: '品牌文化', href: '/about' },
  {
    label: '师资认证',
    href: '/certification',
    children: [
      { label: '师资认证', href: '/certification' },
      { label: '传承弟子', href: '/disciples', badge: 'NEW' },
    ]
  },
  { label: '东方舞圈', href: '/dance-circle', badge: 'NEW' },
];

// 首页品牌文化路径
export const quickCards = [
  {
    id: 1,
    title: '东方舞文化根脉',
    subtitle: '尊重音乐、风格与女性表达',
    description: '从埃及文化语境出发，理解动作背后的音乐、审美与情绪。',
    icon: 'award',
    href: '/about/brand-story',
    bgGradient: 'from-gold to-gold-dark',
    tag: '品牌文化',
    tagColor: 'bg-crimson',
  },
  {
    id: 2,
    title: 'SWOD教学系统',
    subtitle: '清晰、可练习、可复盘',
    description: '把呼吸、核心、胸腰、旋转、手臂与编舞拆解为系统训练路径。',
    icon: 'book',
    href: '/courses',
    bgGradient: 'from-crimson to-crimson-dark',
    tag: '教学体系',
    tagColor: 'bg-gold',
  },
  {
    id: 3,
    title: '师资传承路径',
    subtitle: '从舞者成长为专业教师',
    description: '以长期训练、教学实践和认证考核，延续有标准、有温度的师承。',
    icon: 'award',
    href: '/certification',
    bgGradient: 'from-gold-dark to-crimson',
    tag: '师承体系',
    tagColor: 'bg-gold',
  },
  {
    id: 4,
    title: '《东方舞技巧大全》',
    subtitle: '让东方舞学习有章可循',
    description: '伊娃老师将长期课堂经验整理成可阅读、可教学的出版教材。',
    icon: 'book',
    href: '/shop',
    bgGradient: 'from-crimson-dark to-gold-dark',
    tag: '出版成果',
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
