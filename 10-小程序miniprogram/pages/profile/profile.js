const api = require("../../utils/api");
const { cleanText } = require("../../shared/review-text");
const { formatPaymentAmount } = require("../../shared/money-format");
const app = getApp();

Page({
  data: {
    memberName: "伊娃用户",
    memberPhone: "",
    memberLevel: "",
    memberLevelText: "普通用户",
    avatarUrl: "",
    displayInitial: '伊',
    wechatName: "",
    wechatNameDraft: "",
    isWechatBound: false,
    showWechatBinder: false,
    needsPhoneBinding: false,
    wechatIdentityText: "",
    authorizedCount: 0,
    checkin: { streak: 0 },
    stats: {
      learningCount: 0,
      completedCount: 0,
      completionRate: 0,
      orderCount: 0,
      paidAmount: 0,
      commissionAmount: 0
    },

    recentProgress: [],
    certificates: [],
    isAdmin: false,
    adminRole: ""
  },

  onShow() {
    this.applyLocalLoginState(true);
    const app = getApp();
    if (app && typeof app.ensureSilentLogin === "function") {
      app.ensureSilentLogin().then(() => this.applyLocalLoginState(true));
    }
  },

  applyLocalLoginState(loadRemote) {
    // 检查登录状态
    const memberId = wx.getStorageSync("memberId");
    const memberName = wx.getStorageSync("memberName") || "伊娃用户";
    const app = getApp();
    
    if (memberId) {
      app.globalData.memberId = memberId;
      app.globalData.memberName = memberName;
    } else {
      app.globalData.memberId = null;
      app.globalData.memberName = null;
    }
    
    const history = wx.getStorageSync("checkinHistory") || [];
    const storedWechatProfile = this.getStoredWechatProfile(memberId);
    const initialMemberName = app.globalData.memberName || "未登录";
    this.setData(Object.assign({
      memberName: initialMemberName,
      displayInitial: (storedWechatProfile.wechatName || initialMemberName || '伊')[0] || '伊',
      memberPhone: "",
      memberLevel: "",
      memberLevelText: "普通用户",
      isLoggedIn: !!memberId,
      needsPhoneBinding: false,
      checkin: { streak: history.length }
    }, storedWechatProfile));
    
    if (memberId && loadRemote) {
      this.loadProfile();
      this.loadCertificates();
      this.loadAdminStatus();
    } else {
      this.setData({
        authorizedCount: 0,
        certificates: [],
        showWechatBinder: false
      });
    }
  },

  getStoredWechatProfile(memberId) {
    if (!memberId) {
      return { avatarUrl: "", wechatName: "", wechatNameDraft: "", isWechatBound: false };
    }
    const stored = wx.getStorageSync(`wechatProfile:${memberId}`) || {};
    return {
      avatarUrl: stored.avatarUrl || "",
      wechatName: stored.nickname || "",
      wechatNameDraft: stored.nickname || "",
      isWechatBound: !!(stored.avatarUrl || stored.nickname)
    };
  },

  formatLevel(level) {
    const raw = String(level || "").trim();
    if (!raw) return "普通用户";
    const map = {
      vip: "VIP 用户",
      svip: "SVIP 用户",
      normal: "普通用户",
      regular: "普通用户",
      beginner: "基础用户",
      advanced: "进阶用户"
    };
    return map[raw.toLowerCase()] || raw;
  },

  // 省/州列表（含国外地区）

  // 城市数据（根据省份返回对应城市列表）






  async loadProfile() {
    const profile = await api.getMemberProfile().catch(() => null);
    if (!profile) {
      const authorized = await api.getAuthorizedSeries().catch(() => []);
      this.setData({
        authorizedCount: authorized.length || 0
      });
      return;
    }

    const member = profile.member || profile || {};
    const stats = profile.stats || profile || {};
    const commission = profile.commission_summary || {};
    const wechatName = member.wx_nickname || this.data.wechatName || "";
    const avatarUrl = member.wx_avatar_url || member.avatar_url || this.data.avatarUrl || "";
    if (member.id && (wechatName || avatarUrl)) {
      wx.setStorageSync(`wechatProfile:${member.id}`, {
        nickname: wechatName,
        avatarUrl
      });
    }
    if (member.wx_openid) wx.setStorageSync("wxOpenid", member.wx_openid);
    if (member.wx_unionid) wx.setStorageSync("wxUnionid", member.wx_unionid);
    const loadedName = member.name || app.globalData.memberName;
    this.setData({
      memberName: loadedName,
      displayInitial: (wechatName || loadedName || '伊')[0] || '伊',
      memberPhone: member.phone || "",
      memberLevel: member.level || "",
      memberLevelText: this.formatLevel(member.level),
      wechatName,
      wechatNameDraft: wechatName,
      avatarUrl,
      isLoggedIn: !!member.id,
      needsPhoneBinding: !member.phone,
      isWechatBound: !!(wechatName || avatarUrl || member.wx_profile_synced_at),
      wechatIdentityText: (member.wx_unionid || member.wx_openid) ? "微信身份已同步" : "",
      authorizedCount: stats.authorized_count || 0,
      stats: {
        learningCount: stats.learning_count || 0,
        completedCount: stats.completed_count || 0,
        completionRate: stats.completion_rate || 0,
        orderCount: stats.order_count || 0,
        paidAmount: formatPaymentAmount(stats.paid_amount || 0),
        commissionAmount: formatPaymentAmount(commission.available_amount || 0)
      },
      recentProgress: (profile.recent_progress || []).map(item => ({
        ...item,
        series_name: cleanText(item.series_name),
        course_name: cleanText(item.course_name),
        video_name: cleanText(item.video_name)
      }))
    });
  },



  async loadCertificates() {
    const certificates = await api.getCertificates().catch(() => []);
    this.setData({
      certificates: (Array.isArray(certificates) ? certificates : []).map((cert) => ({
        id: cert.id,
        certificateNo: cert.certificateNo || cert.certificate_no || cert.certNo || "",
        courseName: cleanText(cert.courseName || cert.course_name || cert.name || "播放记录"),
        issueDate: String(cert.issueDate || cert.issue_date || "").slice(0, 10),
        displayIssueDate: String(cert.issueDate || cert.issue_date || "").slice(0, 10) || "待登记日期",
        pdfUrl: cert.pdfUrl || cert.pdf_url || "",
        verifyUrl: cert.verifyUrl || cert.verify_url || "",
        openUrl: cert.pdfUrl || cert.pdf_url || cert.verifyUrl || cert.verify_url || "",
        status: cert.status || "active",
        actionText: (cert.status || "active") === "active" ? "查看" : "已撤销"
      }))
    });
  },

  async onChooseAvatar(e) {
    const avatarUrl = e.detail.avatarUrl || "";
    this.setData({
      avatarUrl,
      isWechatBound: !!(avatarUrl || this.data.wechatNameDraft || this.data.wechatName)
    });
    if (!avatarUrl || !this.data.isLoggedIn) return;
    try {
      const result = await api.uploadWechatAvatar(avatarUrl);
      const uploadedUrl = result.avatar_url || avatarUrl;
      const memberId = wx.getStorageSync("memberId");
      wx.setStorageSync(`wechatProfile:${memberId}`, {
        nickname: this.data.wechatNameDraft || this.data.wechatName || "",
        avatarUrl: uploadedUrl
      });
      this.setData({ avatarUrl: uploadedUrl, isWechatBound: true });
    } catch (err) {
      wx.showToast({ title: "头像稍后同步", icon: "none" });
    }
  },

  onWechatNameInput(e) {
    this.setData({ wechatNameDraft: e.detail.value });
  },

  openWechatBinder() {
    if (!this.data.isLoggedIn) {
      this.goLogin();
      return;
    }
    this.setData({ showWechatBinder: !this.data.showWechatBinder });
  },

  async syncWechatProfile() {
    if (!this.data.isLoggedIn) {
      this.goLogin();
      return;
    }
    wx.showLoading({ title: "绑定中" });
    let nickname = String(this.data.wechatNameDraft || this.data.wechatName || "").trim();
    let avatarUrl = this.data.avatarUrl || "";
    if (!nickname && !avatarUrl) {
      wx.hideLoading();
      wx.showToast({ title: "请选择头像或填写昵称", icon: "none" });
      return;
    }
    try {
      let syncedAvatarUrl = avatarUrl;
      if (avatarUrl && !/^https?:\/\//.test(avatarUrl)) {
        const uploadResult = await api.uploadWechatAvatar(avatarUrl).catch(() => null);
        syncedAvatarUrl = uploadResult?.avatar_url || uploadResult?.avatarUrl || avatarUrl;
      }
      const synced = await api.syncWechatProfile({ nickname, avatarUrl: syncedAvatarUrl });
      const member = synced?.member || synced || {};
      const memberId = wx.getStorageSync("memberId");
      wx.setStorageSync(`wechatProfile:${memberId}`, { nickname, avatarUrl: syncedAvatarUrl });
      if (member.name) wx.setStorageSync("memberName", member.name);
      this.setData({
        memberName: member.name || this.data.memberName,
        wechatName: nickname,
        wechatNameDraft: nickname,
        avatarUrl: syncedAvatarUrl,
        isWechatBound: true,
        showWechatBinder: false,
        wechatIdentityText: (member.wx_unionid || member.wx_openid) ? "微信身份已同步" : this.data.wechatIdentityText
      });
      wx.hideLoading();
      wx.showToast({ title: "微信资料已同步", icon: "success" });
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: err.message || "同步失败", icon: "none" });
    }
  },

  async loadAdminStatus() {
    const status = await api.getAdminStatus().catch(() => null);
    this.setData({
      isAdmin: !!status?.is_admin,
      adminRole: status?.admin?.role || ""
    });
  },

  goAdmin() {
    wx.navigateTo({ url: "/pages/admin/admin" });
  },

  goCertificates() {
    wx.navigateTo({ url: "/pages/certificates/certificates" });
  },

  goProfileEdit() {
    wx.navigateTo({ url: "/pages/profile-edit/profile-edit" });
  },

  showDistribution() {
    wx.showModal({
      title: "邀请记录",
      content: "当前版本仅展示舞蹈内容播放与记录信息。",
      showCancel: false
    });
  },

  showOrders() {
    wx.showToast({ title: `笔记 ${this.data.stats.orderCount || 0} 笔`, icon: "none" });
  },

  viewCertificate(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) {
      wx.showToast({ title: "记录文件未生成", icon: "none" });
      return;
    }
    if (/\.pdf(\?|$)/i.test(url)) {
      wx.downloadFile({
        url,
        success(res) {
          if (res.statusCode === 200) {
            wx.openDocument({ filePath: res.tempFilePath, fileType: "pdf" });
          } else {
            wx.showToast({ title: "记录打开失败", icon: "none" });
          }
        },
        fail() {
          wx.showToast({ title: "记录下载失败", icon: "none" });
        }
      });
      return;
    }
    wx.navigateToMiniProgram ? wx.showModal({
      title: "记录链接",
      content: url,
      showCancel: false
    }) : wx.showToast({ title: "请在浏览器查看记录", icon: "none" });
  },

  showSupport() {
    wx.showModal({
      title: "联系客服",
      content: "如内容未显示，请联系伊娃确认登记信息。",
      showCancel: false
    });
  },

  // 去登录
  goLogin() {
    wx.navigateTo({ url: "/pages/login/login" });
  },

  // 退出登录
  logout() {
    wx.showModal({
      title: "退出登录",
      content: "确定要退出登录吗？",
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync("memberId");
          wx.removeStorageSync("memberName");
          wx.removeStorageSync("token");
          wx.removeStorageSync("wxOpenid");
          wx.removeStorageSync("wxUnionid");
          const app = getApp();
          app.globalData.memberId = null;
          app.globalData.memberName = null;
          this.setData({
            memberName: "未登录",
            memberPhone: "",
            memberLevel: "",
            memberLevelText: "普通用户",
            avatarUrl: "",
            wechatName: "",
            wechatNameDraft: "",
            isWechatBound: false,
            showWechatBinder: false,
            needsPhoneBinding: false,
            wechatIdentityText: "",
            isLoggedIn: false,
            authorizedCount: 0,
            stats: {
              learningCount: 0,
              completedCount: 0,
              completionRate: 0,
              orderCount: 0,
              paidAmount: 0,
              commissionAmount: 0
            },
            recentProgress: [],
            certificates: [],

          });
          wx.showToast({ title: "已退出登录", icon: "success" });
        }
      }
    });
  },

  onAvatarError() {
    this.setData({ avatarUrl: "" });
  }
});
