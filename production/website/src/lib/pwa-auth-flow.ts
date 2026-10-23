export const PWA_HOME_PATH = '/dashboard/profile?source=pwa';
export const PWA_COURSES_PATH = '/courses?source=pwa';
export const PWA_LOGIN_SUCCESS_PATH = '/courses?source=pwa-login';

export type WechatLoginMode = 'wechat' | 'qr' | 'mini';

export type WechatLoginChoice = {
  available: boolean;
  mode: WechatLoginMode;
  label: string;
  error?: string;
};

export function isStandalonePwa() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches
    || Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
}

/**
 * Official-account OAuth is valid only inside WeChat. Every external browser,
 * including an installed iPhone/Android PWA, must use the approved website-app
 * OAuth configuration instead.
 */
export function chooseWechatLogin(input: {
  userAgent: string;
  isDesktop: boolean;
  qrEnabled: boolean;
  isStandalonePwa?: boolean;
  miniAppEnabled?: boolean;
}): WechatLoginChoice {
  const isWechat = /micromessenger/i.test(input.userAgent);
  if (isWechat) {
    return { available: true, mode: 'wechat', label: '微信一键登录' };
  }
  if (!input.isDesktop && input.isStandalonePwa && input.miniAppEnabled) {
    return { available: true, mode: 'mini', label: '微信一键登录' };
  }
  if (input.qrEnabled) {
    return {
      available: true,
      mode: 'qr',
      label: input.isDesktop ? '微信扫码登录' : '微信登录',
    };
  }
  return {
    available: false,
    mode: 'wechat',
    label: '微信一键登录',
    error: '当前浏览器的微信登录尚未配置，请先使用手机号验证码登录。',
  };
}

export function pwaLoginSuccessPath(explicitNext?: string | null) {
  if (explicitNext?.startsWith('/') && !explicitNext.startsWith('//')) return explicitNext;
  return isStandalonePwa() ? PWA_LOGIN_SUCCESS_PATH : '';
}
