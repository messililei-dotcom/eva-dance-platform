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
    domain: 'www.swod.com.cn',
    origin: 'https://www.swod.com.cn',
    home: 'https://www.swod.com.cn',
    courses: 'https://www.swod.com.cn/courses',
    events: 'https://www.swod.com.cn/events',
    shop: 'https://www.swod.com.cn/shop',
    enroll: 'https://www.swod.com.cn/register',
  },
  admin: {
    label: '统一管理后台',
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
  miniapp: {
    label: '网课小程序',
    domain: '微信小程序',
    appId: '',
    apiBase: 'https://api.swod.com.cn/api/mini',
    authBase: 'https://api.swod.com.cn/api/mini',
    adminConfig: 'https://admin.swod.com.cn/miniprogram',
    preview: 'https://admin.swod.com.cn/miniprogram',
  },
  api: {
    gateway: 'https://api.swod.com.cn',
    auth: 'https://api.swod.com.cn/api/mini',
    static: 'https://www.swod.com.cn',
    miniapi: 'https://api.swod.com.cn/api/mini',
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
    description: '小程序统一访问 api.swod.com.cn，由 API 网关聚合认证、课程、订单和学习数据。',
    target: 'miniapp',
  },
];

export function platformHref(surface: PlatformSurface, key: string): string {
  const group = platformLinks[surface] as Record<string, string>;
  return group[key] || group.home || group.origin || '#';
}
