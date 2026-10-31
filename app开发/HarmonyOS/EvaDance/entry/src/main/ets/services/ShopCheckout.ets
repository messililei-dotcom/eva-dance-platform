import { Row, WriteBody } from './Models';

export function goodsInput(product: Row, quantity: number, recipient: string, phone: string, address: string,
  deliveryMethod: string, provider: string, requestKey: string): WriteBody {
  if (!product.id || !Number.isSafeInteger(product.priceFen) || Number(product.priceFen) <= 0 ||
    !Number.isSafeInteger(product.stock) || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99 || quantity > Number(product.stock)) {
    throw new Error('请核对购买数量、价格和可售库存');
  }
  if (!recipient.trim() || recipient.trim().length > 40) throw new Error('请填写收件人，最多40字');
  if (!/^\+?[\d -]{7,25}$/.test(phone.trim())) throw new Error('请填写正确的联系电话');
  if (!['express', 'pickup'].includes(deliveryMethod)) throw new Error('请选择配送方式');
  if (deliveryMethod === 'express' && (address.trim().length < 8 || address.trim().length > 300)) throw new Error('请填写省、市、区及街道门牌号');
  if (!['alipay', 'wechat'].includes(provider) || !requestKey) throw new Error('请重新选择支付方式');
  return { kind: 'goods', items: [{ id: String(product.id), quantity: quantity }], recipient: recipient.trim(), phone: phone.trim(),
    address: deliveryMethod === 'pickup' ? '' : address.trim(), deliveryMethod: deliveryMethod,
    provider: provider, expectedTotalFen: Number(product.priceFen) * quantity, requestKey: requestKey };
}

export function paymentURL(payment: Row): string {
  const url = payment.url || '';
  if (payment.kind !== 'redirect' || !/^https:\/\/(openapi\.alipay\.com|mapi\.alipay\.com|wx\.tenpay\.com)\//.test(url)) {
    throw new Error('当前支付通道暂不可用，请稍后在我的订单中重试');
  }
  return url;
}

export function orderStatus(status: string): string {
  if (status === 'pending') return '待付款';
  if (status === 'paid') return '已付款';
  if (status === 'shipped') return '已发货';
  if (status === 'completed') return '已完成';
  if (status === 'cancelled') return '已取消';
  if (status === 'expired') return '已过期';
  if (status === 'refunded') return '已退款';
  if (['refund_requested', 'refunding'].includes(status)) return '退款处理中';
  return status;
}
