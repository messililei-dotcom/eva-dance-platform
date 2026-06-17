export type PlatformSurface = 'website' | 'admin' | 'miniapp';

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
  miniapp: {
    label: '网课小程序',
    domain: '微信小程序',
    appId: '',
    apiBase: 'https://admin.dongfangwuquan.com/api/mini',
    authBase: 'https://admin.dongfangwuquan.com/api/mini',
    adminConfig: 'https://admin.dongfangwuquan.com/miniprogram',
    preview: 'https://admin.dongfangwuquan.com/miniprogram',
  },
  api: {
    gateway: 'https://admin.dongfangwuquan.com',
    auth: 'https://admin.dongfangwuquan.com/api/mini',
    static: 'https://admin.dongfangwuquan.com',
    miniapi: 'https://admin.dongfangwuquan.com/api/mini',
  },
} as const;

export const platformLinkMatrix: PlatformLinkItem[] = [
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
    description: '内容、学习、活动、商品发布后从后台跳转官网预览。',
    target: 'website',
  },
  {
    key: 'admin-to-miniapp',
    label: '后台 → 网课小程序',
    url: platformLinks.miniapp.adminConfig,
    description: '小程序配置、首页编排、学习上架、版本预览统一在后台管理。',
    target: 'miniapp',
  },
  {
    key: 'miniapp-to-api',
    label: '网课小程序 → API',
    url: platformLinks.miniapp.apiBase,
    description: '小程序只访问 miniapi 与 auth，由 API 网关聚合学习、订单、学习数据。',
    target: 'miniapp',
  },
];

export function platformHref(surface: PlatformSurface, key: string): string {
  const group = platformLinks[surface] as Record<string, string>;
  return group[key] || group.home || group.origin || '#';
}
