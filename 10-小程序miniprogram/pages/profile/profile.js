const api = require("../../utils/api");
const { cleanText } = require("../../shared/review-text");
const { formatPaymentAmount } = require("../../shared/money-format");
const app = getApp();

Page({
  data: {
    memberName: "伊娃学员",
    memberPhone: "",
    memberLevel: "",
    memberLevelText: "普通学员",
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
    authorizedCourses: [],
    offlineCourses: [],
    payments: [],
    consumeRecords: [],
    eventRegistrations: [],
    offlineCourseCount: 0,
    certificates: [],
    isAdmin: false,
    adminRole: "",
    profileLoading: false,
    profileError: ""
  },

  onShow() {
    const app = getApp();
    if (app && typeof app.ensureSilentLogin === "function") {
      app.ensureSilentLogin().catch(() => null).then(() => this.applyLocalLoginState(true));
      return;
    }
    this.applyLocalLoginState(true);
  },

  applyLocalLoginState(loadRemote) {
    // 检查登录状态
    const memberId = wx.getStorageSync("memberId");
    const memberName = wx.getStorageSync("memberName") || "伊娃学员";
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
      memberLevelText: "普通学员",
      isLoggedIn: !!memberId,
      needsPhoneBinding: false,
      checkin: { streak: history.length }
    }, storedWechatProfile));
    
    if (memberId && loadRemote) {
      this.loadProfile();
      this.loadAdminStatus();
    } else {
      this.setData({
        authorizedCount: 0,
        authorizedCourses: [],
        offlineCourses: [],
        payments: [],
        consumeRecords: [],
        eventRegistrations: [],
        offlineCourseCount: 0,
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
    if (!raw) return "普通学员";
    const map = {
      vip: "VIP 学员",
      svip: "SVIP 学员",
      normal: "普通学员",
      regular: "普通学员",
      beginner: "基础学员",
      advanced: "进阶学员"
    };
    return map[raw.toLowerCase()] || raw;
  },

  // 省/州列表（含国外地区）

  // 城市数据（根据省份返回对应城市列表）






  async loadProfile() {
    this.setData({ profileLoading: true, profileError: "" });
    let profileFailure = null;
    const [profile, authorized, recent, catalog, payments, consumeRecords, certificates, eventRegistrations] = await Promise.all([
      api.getMemberProfile().catch(err => { profileFailure = err; return null; }),
      api.getAuthorizedSeries().catch(() => []),
      api.getRecentCourses().catch(() => []),
      api.getSeriesList().catch(() => []),
      api.getPayments().catch(() => []),
      api.getConsumeRecords().catch(() => []),
      api.getCertificates().catch(() => []),
      api.getEventRegistrations().catch(() => [])
    ]);
    if (profileFailure) {
      this.setData({
        profileLoading: false,
        profileError: profileFailure.code === "NETWORK_TIMEOUT"
          ? "连接超时，请检查网络后重新连接。"
          : (profileFailure.message || "个人中心暂时无法连接，请稍后重试。")
      });
      return;
    }
    const member = profile && profile.member || profile || {};
    const memberId = member.id || wx.getStorageSync("memberId");
    const catalogMap = (catalog || []).reduce((map, item) => {
      map[String(item.id || item.series_id)] = item;
      return map;
    }, {});
    let authorizedCourses = (authorized || []).map(item => {
      const id = item.id || item.series_id;
      const source = catalogMap[String(id)] || {};
      return {
        ...source, ...item, id,
        name: cleanText(item.name || item.series_name || source.name, "未命名课程"),
        cover_image: item.cover_image || source.cover_image || "",
        subtitle: item.subtitle || source.subtitle || source.teacher || "",
        total_courses: Number(item.total_courses || item.course_count || source.total_courses || 0)
      };
    });
    const normalizedRecent = (recent || []).map(item => {
      const duration = Number(item.duration || 0), progress = Number(item.progress || 0);
      return {
        ...item,
        series_name: cleanText(item.series_name), course_name: cleanText(item.course_name),
        video_name: cleanText(item.video_name || item.last_video_name),
        percent: item.completed ? 100 : duration > 0 ? Math.min(100, Math.round(progress / duration * 100)) : 0
      };
    });
    const recentBySeries = normalizedRecent.reduce((map, item) => {
      const key = String(item.series_id || item.id || "");
      if (key && (!map[key] || Number(item.percent || 0) > Number(map[key].percent || 0))) map[key] = item;
      return map;
    }, {});
    authorizedCourses = authorizedCourses.map(item => {
      const progress = recentBySeries[String(item.id)] || {};
      return {
        ...item,
        progressPercent: Number(progress.percent || 0)
      };
    });
    const learning = new Set(normalizedRecent.map(item => String(item.series_id || "")).filter(Boolean));
    const completed = new Set(normalizedRecent.filter(item => item.completed).map(item => String(item.series_id || "")).filter(Boolean));
    const completionRate = normalizedRecent.length ? Math.round(normalizedRecent.reduce((sum, item) => sum + item.percent, 0) / normalizedRecent.length) : 0;
    const paidAmount = (payments || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const offlineKeyword = /线下|集训|师资|门徒|培训|私教|工作坊/;
    const offlineCourses = (payments || []).filter(item => offlineKeyword.test(`${item.courseType || item.course_type || ""} ${item.courseName || item.course_name || ""}`)).map(item => ({
      ...item,
      courseName: cleanText(item.courseName || item.course_name || "线下课程"),
      courseSubType: cleanText(item.courseSubType || item.course_sub_type || ""),
      displayDate: String(item.date || item.payment_date || "").slice(0, 10) || "-",
      displayAmount: formatPaymentAmount(item.amount || 0),
      remainingSessions: Number(item.remainingSessions || item.remaining_sessions || 0),
      consumedSessions: Number(item.consumedSessions || item.consumed_sessions || 0),
      paymentMethod: cleanText(item.paymentMethod || item.payment_method || "")
    }));
    const offlineCourseCount = offlineCourses.length;
    const auditStatusMap = { pending: "待审核", approved: "已通过", rejected: "未通过" };
    const paidStatusMap = { unpaid: "待缴费", pending: "待确认", paid: "已缴费", refunded: "已退款" };
    const normalizedEventRegistrations = (eventRegistrations || []).map(item => ({
      ...item,
      competitionName: cleanText(item.competitionName || item.competition_name || "东方舞赛事"),
      groupName: cleanText(item.groupName || item.group_name || "未分组"),
      statusText: auditStatusMap[item.auditStatus || item.audit_status] || item.auditStatus || item.audit_status || "待审核",
      paidStatusText: paidStatusMap[item.paidStatus || item.paid_status] || item.paidStatus || item.paid_status || "",
      resultText: item.resultPublished
        ? `${item.awardName || (item.rankNo ? `第${item.rankNo}名` : "成绩已公示")} · ${item.totalScore == null ? "-" : item.totalScore}分`
        : "成绩待公示",
      displayStartDate: String(item.startDate || item.start_date || "").slice(0, 10),
      competitionId: item.competitionId || item.competition_id
    }));
    const wechatName = member.wx_nickname || this.data.wechatName || "";
    const avatarUrl = member.wx_avatar_url || member.avatar_url || this.data.avatarUrl || "";
    if (memberId && (wechatName || avatarUrl)) {
      wx.setStorageSync(`wechatProfile:${memberId}`, {
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
      isLoggedIn: !!memberId,
      needsPhoneBinding: !member.phone,
      isWechatBound: !!(wechatName || avatarUrl || member.wx_profile_synced_at),
      wechatIdentityText: (member.wx_unionid || member.wx_openid) ? "微信身份已同步" : "",
      authorizedCount: authorizedCourses.length,
      stats: {
        learningCount: learning.size,
        completedCount: completed.size,
        completionRate,
        orderCount: (payments || []).length,
        paidAmount: formatPaymentAmount(paidAmount),
        commissionAmount: formatPaymentAmount(0)
      },
      recentProgress: normalizedRecent,
      authorizedCourses,
      offlineCourses,
      payments: payments || [],
      consumeRecords: consumeRecords || [],
      eventRegistrations: normalizedEventRegistrations,
      offlineCourseCount,
      profileLoading: false,
      profileError: "",
      certificates: (certificates || []).map(cert => ({
        id: cert.id,
        certificateNo: cert.certificateNo || cert.certificate_no || "",
        courseName: cleanText(cert.courseName || cert.course_name || cert.name || "课程证书"),
        displayIssueDate: String(cert.issueDate || cert.issue_date || "").slice(0, 10) || "待登记日期",
        openUrl: cert.pdfUrl || cert.pdf_url || cert.verifyUrl || cert.verify_url || "",
        status: cert.status || "active",
        actionText: (cert.status || "active") === "active" ? "查看" : "已撤销"
      }))
    });
  },

  reconnectProfile() {
    if (this.data.profileLoading) return;
    this.loadProfile();
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

  goCourses() {
    wx.navigateTo({ url: "/pages/courses/courses" });
  },

  openProfileCourse(event) {
    wx.navigateTo({ url: `/pages/player/player?seriesId=${event.currentTarget.dataset.id}` });
  },

  openOfflineSchedule() {
    wx.setStorageSync("offlineTargetTab", "sessions");
    wx.switchTab({ url: "/pages/offline/offline" });
  },

  showPayments() {
    const rows = this.data.payments || [];
    const content = rows.slice(0, 8).map(item => `${item.courseName || item.course_name || "课程"}  ${formatPaymentAmount(item.amount || 0)}`).join("\n");
    wx.showModal({ title: `课程与缴费（${rows.length}）`, content: content || "暂无缴费记录", showCancel: false });
  },

  showConsumeRecords() {
    const rows = this.data.consumeRecords || [];
    const content = rows.slice(0, 8).map(item => `${item.courseName || item.course_name || "课程"}  ${Number(item.count || 0)}课时`).join("\n");
    wx.showModal({ title: `消费记录（${rows.length}）`, content: content || "暂无消费记录", showCancel: false });
  },

  openEventRegistrations() {
    const rows = this.data.eventRegistrations || [];
    if (rows.length === 1) {
      wx.navigateTo({ url: `/pages/event-detail/event-detail?id=${rows[0].competitionId}` });
      return;
    }
    wx.switchTab({ url: "/pages/events/events" });
  },

  openEventRegistration(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/event-detail/event-detail?id=${id}` });
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
            memberLevelText: "普通学员",
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
            authorizedCourses: [],
            offlineCourses: [],
            payments: [],
            consumeRecords: [],
            eventRegistrations: [],
            offlineCourseCount: 0,
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
