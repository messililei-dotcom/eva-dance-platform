const runtimeConfig = require("./shared/runtime-config");
const api = require("./utils/api");

App({
  globalData: {
    apiBase: runtimeConfig.apiBase,
    loginApiBase: runtimeConfig.loginApiBase,
    fallbackApiBases: runtimeConfig.fallbackApiBases,
    fallbackLoginApiBases: runtimeConfig.fallbackLoginApiBases,
    memberId: runtimeConfig.memberId,
    memberName: runtimeConfig.memberName,
    silentLoginPromise: null,
    silentLoginTried: false,
    pwaHandoffPromise: null
  },

  onLaunch(options = {}) {
    this.captureReferral(options);
    this.capturePwaHandoff(options);
    const memberId = wx.getStorageSync("memberId");
    const memberName = wx.getStorageSync("memberName");
    if (memberId) this.globalData.memberId = memberId;
    if (memberName) this.globalData.memberName = memberName;
    this.ensureSilentLogin().then(() => this.completePendingPwaHandoff()).catch(() => null);
  },

  onShow(options = {}) {
    this.captureReferral(options);
    this.capturePwaHandoff(options);
    this.completePendingPwaHandoff();
  },

  capturePwaHandoff(options = {}) {
    const id = String((options.query || {}).pwa_handoff || "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(id)) return;
    wx.setStorageSync("pwaLoginHandoff", { id, capturedAt: Date.now() });
  },

  completePendingPwaHandoff() {
    if (this.globalData.pwaHandoffPromise) return this.globalData.pwaHandoffPromise;
    const pending = wx.getStorageSync("pwaLoginHandoff") || {};
    const handoffId = String(pending.id || "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(handoffId)) return Promise.resolve(null);
    if (Date.now() - Number(pending.capturedAt || 0) > 10 * 60 * 1000) {
      wx.removeStorageSync("pwaLoginHandoff");
      return Promise.resolve(null);
    }

    this.globalData.pwaHandoffPromise = this.ensureSilentLogin()
      .then(() => api.completePwaLoginHandoff(handoffId))
      .then(result => {
        wx.removeStorageSync("pwaLoginHandoff");
        this.returnToPwaAfterHandoff();
        return result;
      })
      .catch(err => {
        const statusCode = Number(err && err.statusCode || 0);
        if (statusCode === 400 || statusCode === 410) wx.removeStorageSync("pwaLoginHandoff");
        return null;
      })
      .finally(() => {
        this.globalData.pwaHandoffPromise = null;
      });
    return this.globalData.pwaHandoffPromise;
  },

  returnToPwaAfterHandoff() {
    const showReturnPage = () => wx.reLaunch({ url: "/pages/pwa-return/pwa-return" });
    if (!wx.exitMiniProgram) return showReturnPage();

    // 部分微信版本会允许从 URL Scheme 启动后直接返回调用方；
    // 若当前版本严格要求点击手势，则降级为专用的单次返回按钮。
    wx.exitMiniProgram({
      fail: showReturnPage
    });
  },

  captureReferral(options = {}) {
    const query = options.query || {};
    const referrerMemberId = Number(
      query.ref_member_id || query.share_member_id || query.inviter_id || 0
    );
    const currentMemberId = Number(wx.getStorageSync("memberId") || 0);
    if (!referrerMemberId || referrerMemberId === currentMemberId) return;
    wx.setStorageSync("referralContext", {
      memberId: referrerMemberId,
      channel: "miniprogram",
      shareCode: String(query.share_code || ""),
      capturedAt: Date.now()
    });
  },

  ensureSilentLogin(force = false) {
    const token = wx.getStorageSync("token");
    const memberId = wx.getStorageSync("memberId");
    if (!force && token && memberId) return Promise.resolve({ token, memberId });
    if (this.globalData.silentLoginPromise) return this.globalData.silentLoginPromise;
    if (!force && this.globalData.silentLoginTried) return Promise.resolve(null);

    this.globalData.silentLoginTried = true;
    this.globalData.silentLoginPromise = new Promise((resolve) => {
      if (!wx.login) {
        resolve(null);
        return;
      }
      wx.login({
        success: async (res) => {
          const code = String(res.code || "").trim();
          if (!code) {
            resolve(null);
            return;
          }
          try {
            const result = await api.silentLogin(code);
            const member = result.data?.member || result.member || {};
            const nextToken = result.data?.token || result.token || "";
            if (member.id && nextToken) {
              wx.setStorageSync("memberId", member.id);
              wx.setStorageSync("memberName", member.wx_nickname || member.name || "");
              wx.setStorageSync("token", nextToken);
              if (member.wx_openid) wx.setStorageSync("wxOpenid", member.wx_openid);
              if (member.wx_unionid) wx.setStorageSync("wxUnionid", member.wx_unionid);
              this.globalData.memberId = member.id;
              this.globalData.memberName = member.wx_nickname || member.name || "";
            }
            resolve(result);
          } catch (err) {
            resolve(null);
          }
        },
        fail: () => resolve(null)
      });
    }).finally(() => {
      this.globalData.silentLoginPromise = null;
    });
    return this.globalData.silentLoginPromise;
  }
});
