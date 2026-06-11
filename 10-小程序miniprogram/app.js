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
    silentLoginTried: false
  },

  onLaunch() {
    const memberId = wx.getStorageSync("memberId");
    const memberName = wx.getStorageSync("memberName");
    if (memberId) this.globalData.memberId = memberId;
    if (memberName) this.globalData.memberName = memberName;
    this.ensureSilentLogin();
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
