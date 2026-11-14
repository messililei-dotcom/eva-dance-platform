const { contentText } = require("../../shared/review-text");
const api = require('../../utils/api');
const shop = require('../../shared/shop');
const share = require('../../shared/share');
const videoFeature = require('../../shared/video-feature');
const virtualPayment = require('../../shared/virtual-payment');

Page(share.withShare('course-checkout', videoFeature.withVideoFeature({
  data: { kind: '', id: '', offer: null, loading: true, busy: false, error: '', paymentEnabled: false, unlocked: false },

  onLoad(options) {
    this.setData({ kind: options.kind, id: options.id });
  },

  onShow() { return this.reload(); },

  async reload() {
    const { kind, id } = this.data;
    this.setData({ loading: true, error: '', offer: null, unlocked: false, paymentEnabled: false, loginRequired: false });
    try {
      if (kind === 'online') {
        if (await virtualPayment.recover?.(id)) {
          this.setData({ unlocked: true });
          return;
        }
        if (wx.getStorageSync('token')) {
          const auth = await api.checkAuthorization(id);
          if (auth.authorized && auth.reason !== 'free_series') {
            this.setData({ unlocked: true });
            return;
          }
        }
        const { offer } = await virtualPayment.quote(id);
        this.setData({ offer: { ...offer, name: contentText(offer.name), priceText: shop.money(offer.priceFen) }, paymentEnabled: virtualPayment.supportsPayment() });
        return;
      }
      const { offer, payment } = await api.request(
        '/shop/courses/' + encodeURIComponent(kind) + '/' + encodeURIComponent(id),
        { auth: kind === 'event' }
      );
      this.setData({ offer: { ...offer, name: contentText(offer.name), priceText: shop.money(offer.priceFen), eventItems: (offer.eventItems || []).map(item => ({ ...item, priceText: shop.money(item.priceFen) })) }, paymentEnabled: !!payment.miniprogram });
    } catch (error) {
      this.setData({ offer: null, error: error.message, loginRequired: error.statusCode === 401 });
    } finally {
      this.setData({ loading: false });
    }
  },

  async submit() {
    if (this.data.unlocked) return this.learn();
    if (this.data.busy || !this.data.offer || !this.data.paymentEnabled) return;
    this.setData({ busy: true, error: '' });
    try {
      if (this.data.kind === 'online') {
        const { id, offer } = this.data;
        if (offer.sandbox === false) {
          await virtualPayment.pay(id, offer.priceFen, true);
          this.setData({ offer: null, paymentEnabled: false, unlocked: true });
          wx.showToast({ title: '内容已解锁', icon: 'success' });
          return;
        }
        await virtualPayment.pay(id, offer.priceFen);
        wx.showModal({
          title: '沙箱订单已核验',
          content: '微信已确认沙箱订单，正式内容权益不受影响。',
          showCancel: false,
        });
        return;
      }
      await this.submitStandard();
    } catch (error) {
      if (error.statusCode === 409) this.setData({ offer: null, paymentEnabled: false });
      this.setData({ error: error.message, loginRequired: error.statusCode === 401 });
    } finally {
      this.setData({ busy: false });
    }
  },

  async submitStandard() {
    const { kind, id, offer } = this.data;
    if (kind !== 'offline' && kind !== 'event') return;
    const input = { kind, targetId: id, provider: 'wechat', expectedTotalFen: offer.priceFen };
    if (kind === 'event' && offer.eventItems?.length) input.eventItems = offer.eventItems.map(item => [item.id, item.priceFen]);
    const key = 'eva-course-checkout-' + (wx.getStorageSync('memberId') || 'guest');
    const fingerprint = JSON.stringify(input);
    let saved = wx.getStorageSync(key);
    if (!saved || saved.fingerprint !== fingerprint) {
      saved = { fingerprint, requestKey: shop.requestKey() };
      wx.setStorageSync(key, saved);
    }
    const data = await api.request('/shop/orders', { method: 'POST', data: { ...input, requestKey: saved.requestKey }, timeout: 30000 });
    wx.removeStorageSync(key);
    try {
      const result = await shop.pay(data.order.id);
      if (kind === 'offline' && ['paid', 'completed'].includes(result?.order?.status)) {
        wx.setStorageSync('offlineTargetCourse', { ids: [String(id)], name: offer.name });
        wx.setStorageSync('offlineTargetTab', 'rights');
        wx.switchTab({ url: '/pages/offline/offline' });
        return;
      }
    } catch (error) {
      wx.showToast({ title: error.message, icon: 'none' });
    }
    wx.redirectTo({ url: '/pages/shop-orders/shop-orders' });
  },

  login() { wx.navigateTo({ url: '/pages/login/login' }); },
  learn() {
    return videoFeature.redirectTo({ url: '/pages/player/player?seriesId=' + encodeURIComponent(this.data.id) });
  },
  orders() { wx.navigateTo({ url: '/pages/shop-orders/shop-orders' }); },
})));
