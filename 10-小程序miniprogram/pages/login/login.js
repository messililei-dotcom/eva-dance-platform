const api = require("../../utils/api");

function showError(message, title = "提示") {
  const text = String(message || "操作失败，请稍后再试").trim();
  if (text.length <= 12) {
    wx.showToast({ title: text, icon: "none" });
    return;
  }
  wx.showModal({
    title,
    content: text,
    showCancel: false
  });
}

function requestErrorMessage(err, fallback) {
  const message = String(err && err.message ? err.message : fallback).trim();
  if (/timeout|request:fail|network/i.test(message)) return "网络连接失败，请稍后重试";
  return message || fallback;
}

Page({
  data: {
    phone: "",
    code: "",
    countdown: 0,
    sending: false,
    logging: false,
    phoneLogging: false
  },
  countdownTimer: null,

  onLoad() {
    // 检查是否已登录
    const memberId = wx.getStorageSync("memberId");
    const token = wx.getStorageSync("token");
    if (memberId && token) {
      wx.switchTab({ url: "/pages/home/home" });
    }
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail.value.replace(/\D/g, '').slice(0, 11) });
  },

  onCodeInput(e) {
    this.setData({ code: e.detail.value.replace(/\D/g, '').slice(0, 6) });
  },

  async sendCode() {
    const { phone } = this.data;
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({ title: "请输入正确手机号", icon: "none" });
      return;
    }

    this.setData({ sending: true });
    try {
      const result = await api.sendCode(phone);
      if (result.success) {
        wx.showToast({ title: "验证码已发送", icon: "success" });
        // 开发模式会返回 code/devCode，直接填充
        if (result.code || result.devCode) {
          this.setData({ code: result.code || result.devCode });
        }
        // 开始倒计时
        this.startCountdown();
      } else {
        showError(result.message || result.error || "发送失败");
      }
    } catch (err) {
      showError(requestErrorMessage(err, "发送失败，请重试"));
    } finally {
      this.setData({ sending: false });
    }
  },

  startCountdown() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
    }
    let seconds = 60;
    this.setData({ countdown: seconds });
    this.countdownTimer = setInterval(() => {
      seconds--;
      if (seconds <= 0) {
        clearInterval(this.countdownTimer);
        this.countdownTimer = null;
        this.setData({ countdown: 0 });
      } else {
        this.setData({ countdown: seconds });
      }
    }, 1000);
  },

  onUnload() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  },

  finishLogin(result) {
    const member = result.data?.member || result.member || result.user;
    const token = result.data?.token || result.token;
    if (!member?.id || !token) throw new Error("登录信息不完整");

    wx.setStorageSync("memberId", member.id);
    wx.setStorageSync("memberName", member.wx_nickname || member.name || "");
    wx.setStorageSync("token", token);
    if (member.wx_openid) wx.setStorageSync("wxOpenid", member.wx_openid);
    if (member.wx_unionid) wx.setStorageSync("wxUnionid", member.wx_unionid);
    if (member.wx_nickname || member.wx_avatar_url || member.avatar_url) {
      wx.setStorageSync(`wechatProfile:${member.id}`, {
        nickname: member.wx_nickname || "",
        avatarUrl: member.wx_avatar_url || member.avatar_url || ""
      });
    }

    const app = getApp();
    app.globalData.memberId = member.id;
    app.globalData.memberName = member.wx_nickname || member.name || "";

    wx.showToast({ title: "登录成功", icon: "success" });
    setTimeout(() => {
      wx.switchTab({ url: "/pages/home/home" });
    }, 600);
  },

  async login() {
    const { phone, code } = this.data;
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({ title: "请输入正确手机号", icon: "none" });
      return;
    }
    if (!code || code.length < 4) {
      wx.showToast({ title: "请输入验证码", icon: "none" });
      return;
    }

    this.setData({ logging: true });
    try {
      const app = getApp();
      if (!wx.getStorageSync("token") && app && typeof app.ensureSilentLogin === "function") {
        await app.ensureSilentLogin(true).catch(() => null);
      }
      const result = await api.studentLogin(phone, code);
      if (result.success) {
        this.finishLogin(result);
      } else {
        showError(result.message || result.error || "登录失败", "登录失败");
      }
    } catch (err) {
      showError(requestErrorMessage(err, "登录失败"), "登录失败");
    } finally {
      this.setData({ logging: false });
    }
  },

  async loginByPhoneAuth(e) {
    if (this.data.phoneLogging || this.data.logging) return;
    const detail = e.detail || {};
    if (detail.errMsg && detail.errMsg.indexOf("ok") < 0) {
      showError("请授权手机号后登录，也可使用验证码登录");
      return;
    }
    const code = String(detail.code || "").trim();
    if (!code) {
      showError("暂未获取到手机号授权，请重新点击一键登录或使用验证码登录");
      return;
    }

    this.setData({ phoneLogging: true });
    try {
      const app = getApp();
      if (!wx.getStorageSync("token") && app && typeof app.ensureSilentLogin === "function") {
        await app.ensureSilentLogin(true).catch(() => null);
      }
      const result = await api.phoneLogin(code);
      if (result.success) {
        this.finishLogin(result);
      } else {
        showError(result.message || result.error || "登录失败", "登录失败");
      }
    } catch (err) {
      showError(requestErrorMessage(err, "登录失败"), "登录失败");
    } finally {
      this.setData({ phoneLogging: false });
    }
  },

  goBack() {
    wx.navigateBack();
  }
});
