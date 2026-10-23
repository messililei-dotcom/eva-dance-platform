export type PlatformSurface = 'website' | 'admin' | 'learn' | 'miniapp';

export interface PlatformLinkItem {
  key: string;
  label: string;
  url: string;
  description: string;
  target: PlatformSurface;
}

export const platformLinks = {
  website: {
    label: '品牌官网',
    domain: 'www.swod.com.cn',
    origin: 'https://www.swod.com.cn',
    home: '/',
    courses: '/courses',
    events: '/events-news',
    shop: '/shop',
    enroll: '/register',
  },
  admin: {
    label: '统一管理平台',
    domain: 'admin.swod.com.cn',
    origin: 'https://admin.swod.com.cn',
    home: 'https://admin.swod.com.cn/dashboard',
    login: 'https://admin.swod.com.cn/login',
    members: 'https://admin.swod.com.cn/members',
    courses: 'https://admin.swod.com.cn/courses',
    orders: 'https://admin.swod.com.cn/orders',
    ecommerce: 'https://admin.swod.com.cn/ecommerce',
    finance: 'https://admin.swod.com.cn/finance',
    miniprogram: 'https://admin.swod.com.cn/miniprogram',
    settings: 'https://admin.swod.com.cn/settings',
  },
  learn: {
    label: '个人中心',
    domain: 'www.swod.com.cn',
    origin: 'https://www.swod.com.cn',
    home: '/profile',
    login: '/?login=1',
    courses: '/courses',
    calendar: '/profile#offline-courses',
    assignments: '/courses',
    support: '/contact',
  },
  miniapp: {
    label: '网课小程序',
    domain: '微信小程序',
    appId: '',
    apiBase: 'https://admin.swod.com.cn/api/mini',
    authBase: 'https://admin.swod.com.cn/api/mini',
    adminConfig: 'https://admin.swod.com.cn/miniprogram',
    preview: 'https://admin.swod.com.cn/miniprogram',
  },
  api: {
    gateway: 'https://admin.swod.com.cn',
    auth: 'https://admin.swod.com.cn/api/mini',
    static: 'https://admin.swod.com.cn',
    miniapi: 'https://admin.swod.com.cn/api/mini',
  },
} as const;

export const platformLinkMatrix: PlatformLinkItem[] = [
  {
    key: 'website-to-learn',
    label: '官网 → 个人中心',
    url: platformLinks.learn.home,
    description: '官网课程详情和招生页保持在官网浏览，课程入口直达对应学习页。',
    target: 'learn',
  },
  {
    key: 'website-to-admin',
    label: '官网 → 统一管理平台',
    url: platformLinks.admin.login,
    description: '统一管理平台是所有业务数据的根本和来源，仅管理员使用。',
    target: 'admin',
  },
  {
    key: 'admin-to-website',
    label: '统一管理平台 → 官网',
    url: platformLinks.website.home,
    description: '内容、课程、活动、商品发布后从统一管理平台跳转官网预览。',
    target: 'website',
  },
  {
    key: 'admin-to-learn',
    label: '统一管理平台 → 个人中心',
    url: platformLinks.learn.home,
    description: '运营和教务从统一管理平台的数据源预览官网个人中心体验。',
    target: 'learn',
  },
  {
    key: 'admin-to-miniapp',
    label: '统一管理平台 → 网课小程序',
    url: platformLinks.miniapp.adminConfig,
    description: '小程序配置、首页编排、课程上架、版本预览统一读取管理平台数据。',
    target: 'miniapp',
  },
  {
    key: 'miniapp-to-api',
    label: '网课小程序 → API',
    url: platformLinks.miniapp.apiBase,
    description: '小程序只访问 miniapi 与 auth，由 API 网关聚合课程、订单、学习数据。',
    target: 'miniapp',
  },
  {
    key: 'learn-to-website',
    label: '个人中心 → 官网',
    url: platformLinks.website.home,
    description: '品牌内容、活动介绍、公开课程回到官网展示。',
    target: 'website',
  },
];

export function platformHref(surface: PlatformSurface, key: string): string {
  const group = platformLinks[surface] as Record<string, string>;
  return group[key] || group.home || group.origin || '#';
}
