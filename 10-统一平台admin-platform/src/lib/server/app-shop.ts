import { shopConfig, paymentAvailability } from './shop-payments';
// Keep new App checkout gated until its authenticated API has been deployed and verified.
export function appShopPayment(platform: string = '') {
  const c = shopConfig(), payment = paymentAvailability(c);
  const enabled = process.env.APP_PHYSICAL_CHECKOUT_ENABLED === 'true' || (platform === 'harmony' && process.env.HARMONY_PHYSICAL_CHECKOUT_ENABLED === 'true');
  return { alipay: enabled && payment.alipay, wechat: enabled && payment.wechat && c.wxH5 };
}
