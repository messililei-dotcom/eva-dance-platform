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
    domain: 'www.dongfangwuquan.com',
    origin: 'https://www.dongfangwuquan.com',
    home: 'https://www.dongfangwuquan.com',
    courses: 'https://www.dongfangwuquan.com/courses',
    events: 'https://www.dongfangwuquan.com/events',
    shop: 'https://www.dongfangwuquan.com/shop',
    enroll: 'https://www.dongfangwuquan.com/register',
  },
  admin: {
    label: '统一管理后台',
    domain: 'admin.dongfangwuquan.com',
    origin: 'https://admin.dongfangwuquan.com',
    home: 'https://admin.dongfangwuquan.com/dashboard',
    login: 'https://admin.dongfangwuquan.com/login',
    members: 'https://admin.dongfangwuquan.com/members',
    courses: 'https://admin.dongfangwuquan.com/courses',
    orders: 'https://admin.dongfangwuquan.com/orders',
    ecommerce: 'https://admin.dongfangwuquan.com/ecommerce',
    finance: 'https://admin.dongfangwuquan.com/finance',
    miniprogram: 'https://admin.dongfangwuquan.com/miniprogram',
    settings: 'https://admin.dongfangwuquan.com/settings',
  },
  learn: {
    label: '学员学习中心',
    domain: 'learn.dongfangwuquan.com',
    origin: 'https://learn.dongfangwuquan.com',
    home: 'https://learn.dongfangwuquan.com/learn',
    login: 'https://learn.dongfangwuquan.com/login',
    courses: 'https://learn.dongfangwuquan.com/learn#courses',
    calendar: 'https://learn.dongfangwuquan.com/learn#calendar',
    assignments: 'https://learn.dongfangwuquan.com/learn#assignments',
    support: 'https://learn.dongfangwuquan.com/learn#support',
  },
  miniapp: {
    label: '网课小程序',
    domain: '微信小程序',
    appId: '',
    apiBase: 'https://miniapi.dongfangwuquan.com',
    authBase: 'https://auth.dongfangwuquan.com',
    adminConfig: 'https://admin.dongfangwuquan.com/miniprogram',
    preview: 'https://admin.dongfangwuquan.com/miniprogram',
  },
  api: {
    gateway: 'https://api.dongfangwuquan.com',
    auth: 'https://auth.dongfangwuquan.com',
    static: 'https://static.dongfangwuquan.com',
    miniapi: 'https://miniapi.dongfangwuquan.com',
  },
} as const;

export const platformLinkMatrix: PlatformLinkItem[] = [
  {
    key: 'website-to-learn',
    label: '官网 → 学员中心',
    url: platformLinks.learn.home,
    description: '官网课程详情、招生页、登录入口统一引导学员进入学习中心。',
    target: 'learn',
  },
  {
    key: 'website-to-admin',
    label: '官网 → 管理后台',
    url: platformLinks.admin.login,
    description: '仅管理员使用，官网不暴露为普通用户主入口。',
    target: 'admin',
  },
  {
    key: 'admin-to-website',
    label: '后台 → 官网',
    url: platformLinks.website.home,
    description: '内容、课程、活动、商品发布后从后台跳转官网预览。',
    target: 'website',
  },
  {
    key: 'admin-to-learn',
    label: '后台 → 学员中心',
    url: platformLinks.learn.home,
    description: '运营和教务从会员详情、课程管理预览学员侧学习体验。',
    target: 'learn',
  },
  {
    key: 'admin-to-miniapp',
    label: '后台 → 网课小程序',
    url: platformLinks.miniapp.adminConfig,
    description: '小程序配置、首页编排、课程上架、版本预览统一在后台管理。',
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
    label: '学员中心 → 官网',
    url: platformLinks.website.home,
    description: '品牌内容、活动介绍、公开课程回到官网展示。',
    target: 'website',
  },
];

export function platformHref(surface: PlatformSurface, key: string): string {
  const group = platformLinks[surface] as Record<string, string>;
  return group[key] || group.home || group.origin || '#';
}
