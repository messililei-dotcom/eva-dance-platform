const api = require('../utils/api');

function supportsPayment() {
  return typeof wx.requestVirtualPayment === 'function';
}

function liveCheckout() {
  try { return wx.getAccountInfoSync().miniProgram.envVersion !== 'develop'; }
  catch { return true; }
}

function quote(seriesId) {
  const live = liveCheckout();
  return api.request((live ? '/virtual-payment/live/quote/' : '/virtual-payment/quote/') + encodeURIComponent(seriesId), { retry: false })
    .then(result => ({ ...result, offer: { ...result.offer, sandbox: !live } }));
}

async function recover(seriesId) {
  if (!liveCheckout() || !wx.getStorageSync('token')) return false;
  const result = await api.request('/virtual-payment/live/recover/' + encodeURIComponent(seriesId), {
    method: 'POST', retry: false, timeout: 16000,
  }).catch(() => null);
  return result?.status === 'verified';
}

async function pay(seriesId, priceFen, live = false) {
  const path = live ? '/virtual-payment/live/' : '/virtual-payment/';
  if (!supportsPayment()) throw new Error('请使用支持虚拟支付的微信客户端');
  const code = await new Promise((resolve, reject) => wx.login({
    success: result => result.code ? resolve(result.code) : reject(new Error('获取微信登录凭证失败')),
    fail: () => reject(new Error('获取微信登录凭证失败')),
  }));
  const order = await api.request(path + 'prepare/' + encodeURIComponent(seriesId), {
    method: 'POST', data: { code, expectedPriceFen: priceFen }, retry: false, timeout: 15000,
  });
  if (order.status === 'verified') return order;
  if (!(live ? /^VL[0-9a-f]{30}$/ : /^VX[0-9a-f]{30}$/).test(order.id || '') || !order.payment) throw new Error('虚拟支付下单失败');
  const { mode, signData, paySig, signature } = order.payment;
  if (mode !== 'short_series_goods' || typeof signData !== 'string' ||
      !/^[0-9a-f]{64}$/.test(paySig || '') || !/^[0-9a-f]{64}$/.test(signature || '')) {
    throw new Error('虚拟支付参数无效');
  }
  let signedOrder;
  try { signedOrder = JSON.parse(signData); } catch { throw new Error('虚拟支付参数无效'); }
  if (signedOrder?.env !== (live ? 0 : 1) || signedOrder.outTradeNo !== order.id || signedOrder.goodsPrice !== priceFen) {
    throw new Error('微信支付参数与订单不匹配');
  }
  let failure;
  try {
    await new Promise((resolve, reject) => wx.requestVirtualPayment({
      mode, signData, paySig, signature, success: resolve, fail: reject,
    }));
  } catch (error) {
    failure = error;
  }
  if (Number(failure?.errCode) === -15014) {
    throw new Error(live ? '课程商品正在同步，请稍后重试' : '沙箱道具正在同步，约十分钟后可测试支付');
  }
  const result = await api.request(path + 'orders/' + encodeURIComponent(order.id), {
    method: live ? 'POST' : 'GET', retry: false, timeout: 20000,
  }).catch(() => null);
  if (result?.status === 'verified') return result;
  if (/cancel/i.test(failure?.errMsg || '')) throw new Error('已取消支付');
  throw new Error('支付结果待确认，请稍后重试查询');
}

module.exports = { quote, pay, supportsPayment, recover };
