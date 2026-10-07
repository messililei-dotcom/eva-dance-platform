const share = require("../../shared/share");
const videoFeature = require("../../shared/video-feature");
const api = require("../../utils/api");
const { cleanText } = require("../../shared/review-text");
const { formatPaymentAmount } = require("../../shared/money-format");
const app = getApp();

Page(share.withShare("profile", videoFeature.withVideoFeature({
  data: {
    profileOpen: false, profileDraft: {}, profileSaving: false, profileDirty: false, profileSaveMessage: "", avatarSaving: false,
    genderOptions: ["未填写", "女", "男"], genderIndex: 0,
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
    authorizedCourses: [],
    offlineCourses: [],
    eventRegistrations: [],
    certificates: [],
    isAdmin: false,
    adminRole: "",
    unreadMessageCount: 0,
    profileLoading: false,
    profileError: ""
  },

  onShow() {
    this.stopUnreadPolling();
    this.unreadTimer = setInterval(() => { if (this.data.isLoggedIn) this.loadUnreadMessages(); }, 60000);
    const app = getApp();
    if (app && typeof app.ensureSilentLogin === "function") {
      app.ensureSilentLogin().catch(() => null).then(() => this.applyLocalLoginState(true));
      return;
    }
    this.applyLocalLoginState(true);
  },

  onHide() { this.stopUnreadPolling(); },
  onUnload() { this.stopUnreadPolling(); },
  stopUnreadPolling() { if (this.unreadTimer) clearInterval(this.unreadTimer); this.unreadTimer = null; },
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
    
    const storedWechatProfile = this.getStoredWechatProfile(memberId);
    const initialMemberName = app.globalData.memberName || "未登录";
    this.setData(Object.assign({
      memberName: initialMemberName,
      displayInitial: (storedWechatProfile.wechatName || initialMemberName || '伊')[0] || '伊',
      memberPhone: "",
      memberLevel: "",
      memberLevelText: "普通学员",
      isLoggedIn: !!memberId,
      needsPhoneBinding: false
    }, storedWechatProfile));
    
    if (memberId && loadRemote) {
      this.loadProfile();
      this.loadAdminStatus();
      this.loadUnreadMessages();
    } else {
      this.setData({
        unreadMessageCount: 0,
        authorizedCourses: [],
        offlineCourses: [],
                eventRegistrations: [],
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
      isWechatBound: !!(wx.getStorageSync("wxOpenid") || wx.getStorageSync("wxUnionid"))
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

  async loadProfile() {
    const requestId = this.profileRequestId = (this.profileRequestId || 0) + 1;
    const requestedMember = wx.getStorageSync("memberId");
    this.setData({ profileLoading: true, profileError: "" });
    let profileFailure = null;
    const [profile, authorized, recent, catalog, payments, certificates, eventRegistrations] = await Promise.all([
      api.getMemberProfile().catch(err => { profileFailure = err; return null; }),
      api.getAuthorizedSeries().catch(() => []),
      api.getRecentCourses().catch(() => []),
      api.getSeriesList().catch(() => []),
      api.getPayments().catch(() => []),
      api.getCertificates().catch(() => []),
      api.getEventRegistrations().catch(() => [])
    ]);
    if (requestId !== this.profileRequestId || requestedMember !== wx.getStorageSync("memberId")) return;
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
    let authorizedCourses = (authorized || []).filter(item => catalogMap[String(item.id || item.series_id)]).map(item => {
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
    this.profileMember = member;
    if (!this.data.profileDirty) this.setData({ profileDraft: this.profileDraftFrom(member), genderIndex: Math.max(0, this.data.genderOptions.indexOf(member.gender || "未填写")) });
    const wechatName = member.wx_name || member.wx_nickname || this.data.wechatName || "";
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
      isWechatBound: !!(member.wx_openid || member.wx_unionid),
      wechatIdentityText: (member.wx_unionid || member.wx_openid) ? "微信身份已同步" : "",
      authorizedCourses,
      offlineCourses,
      eventRegistrations: normalizedEventRegistrations,
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

  async onChooseAvatar(e) {
    const avatarUrl = e.detail.avatarUrl || "";
    if (!avatarUrl || !this.data.isLoggedIn || this.data.avatarSaving) return;
    const memberId = wx.getStorageSync("memberId");
    this.setData({ avatarSaving: true });
    try {
      const result = await api.uploadWechatAvatar(avatarUrl);
      if (memberId !== wx.getStorageSync("memberId")) return;
      const uploadedUrl = result.avatar_url || result.avatarUrl;
      if (!uploadedUrl) throw new Error('头像上传失败');
      wx.setStorageSync(`wechatProfile:${memberId}`, { nickname: this.data.wechatName || "", avatarUrl: uploadedUrl });
      this.setData({ avatarUrl: uploadedUrl });
      wx.showToast({ title: '头像已更新', icon: 'success' });
    } catch (err) { wx.showToast({ title: err.message || '头像上传失败，请重试', icon: 'none' }); }
    finally { this.setData({ avatarSaving: false }); }
  },

  onWechatNameInput(e) {
    this.setData({ wechatNameDraft: e.detail.value });
  },

  openWechatBinder() {
    if (!this.data.isLoggedIn) {
      this.goLogin();
      return;
    }
    this.setData({ profileOpen: true, showWechatBinder: !this.data.showWechatBinder });
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
        isWechatBound: !!(member.wx_openid || member.wx_unionid),
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
    const memberId = wx.getStorageSync("memberId");
    const status = await api.getAdminStatus().catch(() => null);
    if (memberId !== wx.getStorageSync("memberId")) return;
    this.setData({
      isAdmin: !!status?.is_admin,
      adminRole: status?.admin?.role || ""
    });
  },

  goAdmin() {
    videoFeature.navigateTo({ url: "/pages/admin/admin" });
  },

  goCommerceOrders() {
    wx.navigateTo({ url: "/pages/shop-orders/shop-orders" });
  },

  openProfileCourse(event) {
    videoFeature.navigateTo({ url: `/pages/player/player?seriesId=${event.currentTarget.dataset.id}` });
  },

  openOfflineSchedule() {
    wx.setStorageSync("offlineTargetTab", "sessions");
    wx.switchTab({ url: "/pages/offline/offline" });
  },

  openEventRegistrations() {
    const rows = this.data.eventRegistrations || [];
    if (rows.length === 1) {
      videoFeature.navigateTo({ url: `/pages/event-detail/event-detail?id=${rows[0].competitionId}` });
      return;
    }
    wx.switchTab({ url: "/pages/events/events" });
  },

  openEventRegistration(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    videoFeature.navigateTo({ url: `/pages/event-detail/event-detail?id=${id}` });
  },

  goProfileEdit() { this.toggleProfile(); },
  toggleProfile() {
    if (!this.data.isLoggedIn) return this.goLogin();
    this.setData({ profileOpen: !this.data.profileOpen });
  },
  profileDraftFrom(member) {
    return { name: member.wx_name || member.wx_nickname || member.name || '', wxAccount: member.wx_account || '', gender: member.gender || '', birthday: String(member.birthday || '').slice(0, 10), country: member.country || '中国', province: member.province || '', city: member.city || '', address: member.address || '' };
  },
  onProfileFieldInput(event) {
    const key = event.currentTarget.dataset.field;
    if (!['name', 'wxAccount', 'country', 'province', 'city', 'address'].includes(key)) return;
    this.setData({ profileDraft: { ...this.data.profileDraft, [key]: event.detail.value }, profileDirty: true, profileSaveMessage: '' });
  },
  onProfileGender(event) {
    const index = Number(event.detail.value);
    if (!Number.isInteger(index) || index < 0 || index >= this.data.genderOptions.length) return;
    this.setData({ genderIndex: index, profileDraft: { ...this.data.profileDraft, gender: index ? this.data.genderOptions[index] : '' }, profileDirty: true });
  },
  onProfileBirthday(event) { this.setData({ profileDraft: { ...this.data.profileDraft, birthday: event.detail.value }, profileDirty: true }); },
  async saveProfileFields() {
    if (!this.data.isLoggedIn) return this.goLogin();
    if (this.data.profileSaving || this.data.profileLoading || this.data.profileError) return;
    const draftSnapshot = JSON.stringify(this.data.profileDraft);
    const draft = { ...this.data.profileDraft, name: String(this.data.profileDraft.name || '').trim() };
    if (!draft.name) return wx.showToast({ title: '请填写姓名', icon: 'none' });
    const memberId = wx.getStorageSync('memberId');
    this.setData({ profileSaving: true, profileSaveMessage: '' });
    try {
      const response = await api.updateMemberProfile({ ...draft, wxName: draft.name, wxNickname: draft.name, remark: this.profileMember && this.profileMember.remark || '' });
      if (memberId !== wx.getStorageSync('memberId')) return;
      const member = response && response.member || response || {};
      this.profileMember = member;
      const changedWhileSaving = JSON.stringify(this.data.profileDraft) !== draftSnapshot;
      this.setData({ memberName: member.name || draft.name, wechatName: member.wx_name || member.wx_nickname || draft.name, wechatNameDraft: member.wx_name || member.wx_nickname || draft.name, profileSaveMessage: '个人资料已保存', profileDirty: changedWhileSaving });
      if (!changedWhileSaving) this.setData({ profileDraft: this.profileDraftFrom(member) });
      wx.setStorageSync('memberName', member.name || draft.name);
      wx.setStorageSync(`wechatProfile:${memberId}`, { nickname: member.wx_name || member.wx_nickname || draft.name, avatarUrl: this.data.avatarUrl });
      app.globalData.memberName = member.name || draft.name;
    } catch (err) { this.setData({ profileSaveMessage: err.message || '保存失败，请重试' }); }
    finally { this.setData({ profileSaving: false }); }
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
    const id = Number(e.currentTarget.dataset.id);
    const imageUrl = /\.(png|jpe?g|webp)(\?|$)/i.test(url) ? url
      : Number.isSafeInteger(id) && id > 0
        ? `${app.globalData.apiBase}/certificates/${id}/preview`
        : '';
    if (!imageUrl) { wx.showToast({ title: '证书暂时无法预览', icon: 'none' }); return; }
    const token = wx.getStorageSync('token');
    const header = imageUrl.startsWith(app.globalData.apiBase + '/certificates/') && token ? { Authorization: `Bearer ${token}` } : {};
    wx.downloadFile({ url: imageUrl, header, success(res) {
      if (res.statusCode === 200) wx.previewImage({ current: res.tempFilePath, urls: [res.tempFilePath] });
      else wx.showToast({ title: res.statusCode === 401 ? '登录已过期，请重新登录' : '证书不存在或暂未生成', icon: 'none' });
    }, fail() { wx.showToast({ title: '证书加载失败，请重试', icon: 'none' }); } });
  },

  // 去登录
  async loadUnreadMessages() {
    const memberId = wx.getStorageSync('memberId');
    try {
      const result = await api.getUnreadMessageCount();
      if (memberId === wx.getStorageSync('memberId')) this.setData({ unreadMessageCount: Number(result.count || 0) });
    } catch (_) { this.setData({ unreadMessageCount: 0 }); }
  },
  goMessages() { wx.navigateTo({ url: '/pages/messages/messages' }); },
  goLogin() {
    videoFeature.navigateTo({ url: "/pages/login/login" });
  },

  // 退出登录
  logout() {
    wx.showModal({
      title: "退出登录",
      content: "确定要退出登录吗？",
      success: (res) => {
        if (res.confirm) {
          this.profileRequestId = (this.profileRequestId || 0) + 1;
          this.stopUnreadPolling();
          this.profileMember = null;
          this.setData({ profileOpen: false, profileDraft: {}, profileDirty: false, profileSaveMessage: "", isAdmin: false, adminRole: "" });
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
                stats: {
              learningCount: 0,
              completedCount: 0,
              completionRate: 0,
              orderCount: 0,
              paidAmount: 0,
              commissionAmount: 0
            },
            recentProgress: [],
            unreadMessageCount: 0,
        authorizedCourses: [],
            offlineCourses: [],
                            eventRegistrations: [],
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
})));
