const share = require("../../shared/share");
const api = require("../../utils/api");
const { formatPrice } = require("../../shared/money-format");
const { groupOfflineCourses } = require("../../shared/offline-catalog");

function cleanDate(value) {
  return String(value || "").slice(0, 10);
}

function courseTitle(item) {
  return [item.course_name || "线下课程", item.course_period].filter(Boolean).join(" · ");
}

function lessonTime(item) {
  const time = [item.start_time, item.end_time].filter(Boolean).join("–");
  return [item.session_date, time].filter(Boolean).join(" ");
}

function locationText(item) {
  return item.classroom || item.address || "上课地点待定";
}

function normalizeCourse(item) {
  return {
    ...item,
    id: item.id,
    name: item.name || "线下课程",
    coverImage: item.cover_image || "",
    subtitle: item.subtitle || item.description || item.category || "",
    teacherText: item.teacher || "伊娃东方舞导师",
    dateText: item.latestPeriodText === "期次待公布" ? "期次安排待公布" : `最新期次：${item.latestPeriodText}`,
    sessionsText: item.periodText || "1 个期次",
    priceText: Number(item.minPrice || item.price || 0) > 0
      ? `${formatPrice(item.minPrice || item.price)}${item.periodCount > 1 ? "起" : ""}`
      : "咨询价格"
  };
}

function normalizeBooking(item) {
  const statusLabels = { booked: "已预约", checked_in: "已签到", consumed: "已到课", cancelled: "已取消" };
  return {
    ...item,
    title: courseTitle(item),
    timeText: lessonTime(item),
    locationText: locationText(item),
    statusText: statusLabels[item.status] || item.status || "已预约",
    canCheckin: item.status === "booked",
    code: ""
  };
}

function normalizeSession(item, activeBookedIds) {
  const booked = Number(item.actual_booked_count ?? item.booked_count ?? 0);
  const capacity = Number(item.capacity || 0);
  const alreadyBooked = activeBookedIds.has(String(item.id));
  const canBook = Boolean(Number(item.can_book)) && !alreadyBooked && (!capacity || booked < capacity);
  return {
    ...item,
    title: courseTitle(item),
    timeText: lessonTime(item),
    locationText: locationText(item),
    booked,
    capacity,
    canBook,
    actionText: canBook ? "预约" : alreadyBooked ? "已预约" : (capacity && booked >= capacity) ? "已满员" : item.booking_reason || "不可预约"
  };
}

function normalizeRight(item) {
  return {
    ...item,
    title: courseTitle(item),
    available: Number(item.available_sessions || 0),
    frozen: Number(item.frozen_sessions || 0),
    used: Number(item.used_sessions || 0),
    validUntil: cleanDate(item.valid_until) || "长期有效"
  };
}

Page(share.withShare("offline", {
  data: {
    loading: true,
    overviewLoading: true,
    courseError: "", overviewError: "", sessionCourseName: "", sessionCourseIds: [],
    activeTab: "courses",
    keyword: "",
    courses: [],
    visibleCourses: [],
    bookings: [],
    sessions: [],
    rights: [],
    actingId: "",
    availableSessions: 0,
    pendingCount: 0,
    consumedCount: 0,
    tabs: [
      { key: "courses", label: "全部课程" },
      { key: "bookings", label: "已预约" },
      { key: "sessions", label: "去约课" },
      { key: "rights", label: "我的课次" }
    ]
  },
  onShow() {
    const targetTab = wx.getStorageSync("offlineTargetTab");
    if (targetTab) {
      wx.removeStorageSync("offlineTargetTab");
      this.setData({ activeTab: targetTab });
    }
    const targetCourse = wx.getStorageSync("offlineTargetCourse");
    if (targetCourse) {
      wx.removeStorageSync("offlineTargetCourse");
      this.setData({ sessionCourseName: targetCourse.name || "", sessionCourseIds: targetCourse.ids || [] });
    }
    this.loadAll();
  },
  onPullDownRefresh() {
    this.loadAll().finally(() => wx.stopPullDownRefresh());
  },
  loadAll() {
    return Promise.all([this.loadCourses(), this.loadOverview()]);
  },
  async loadCourses() {
    this.setData({ loading: true, courseError: "" });
    try {
      const rows = await api.getOfflineCourses();
      const courses = groupOfflineCourses(rows || []).map(normalizeCourse);
      this.setData({ courses, visibleCourses: this.filterCourses(courses, this.data.keyword) });
    } catch (err) {
      this.setData({ courseError: err.message || "课程加载失败，请重试" });
    } finally { this.setData({ loading: false }); }
  },
  async loadOverview() {
    this.setData({ overviewLoading: true, overviewError: "" });
    try {
      const overview = await api.getOfflineOverview(this.data.sessionCourseIds || []);
      const bookings = (overview.bookings || []).map(normalizeBooking);
      const activeBookedIds = new Set(bookings.filter(item => !["cancelled", "consumed"].includes(item.status)).map(item => String(item.session_id)));
      const filterIds = this.data.sessionCourseIds || [];
      const sessions = (overview.sessions || []).filter(item => !filterIds.length || filterIds.includes(String(item.course_id))).map(item => normalizeSession(item, activeBookedIds));
      const rights = (overview.entitlements || []).map(normalizeRight);
      this.setData({ bookings, sessions, rights,
        availableSessions: rights.reduce((sum, item) => sum + item.available, 0),
        pendingCount: bookings.filter(item => item.status === "booked").length,
        consumedCount: bookings.filter(item => ["checked_in", "consumed"].includes(item.status)).length });
    } catch (err) {
      this.setData({ overviewError: err.message || "个人课次加载失败，请重试" });
    } finally { this.setData({ overviewLoading: false }); }
  },
  clearSessionFilter() {
    this.setData({ sessionCourseIds: [], sessionCourseName: "" });
    return this.loadOverview();
  },
  switchTab(event) {
    this.setData({ activeTab: event.currentTarget.dataset.key });
  },
  filterCourses(courses, keyword) {
    const query = String(keyword || "").trim().toLowerCase();
    return query
      ? courses.filter(item => `${item.searchText || ""} ${item.name} ${item.subtitle} ${item.teacherText} ${item.category || ""}`.toLowerCase().includes(query))
      : courses;
  },
  onSearchInput(event) {
    const keyword = String(event.detail.value || "");
    this.setData({ keyword, visibleCourses: this.filterCourses(this.data.courses, keyword) });
  },
  onImageError(event) {
    const path = event.currentTarget.dataset.path;
    if (path) this.setData({ [path]: "" });
  },
  openCourse(event) {
    wx.navigateTo({ url: `/pages/offline-detail/offline-detail?id=${event.currentTarget.dataset.id}` });
  },
  async bookSession(event) {
    const id = String(event.currentTarget.dataset.id);
    if (!id || this.data.actingId) return;
    this.setData({ actingId: `session-${id}` });
    try {
      await api.bookOfflineSession(id);
      wx.showToast({ title: "预约成功，已冻结1课次", icon: "none" });
      await this.loadOverview();
      this.setData({ activeTab: "bookings" });
    } catch (err) {
      wx.showToast({ title: err.message || "预约失败", icon: "none" });
    } finally {
      this.setData({ actingId: "" });
    }
  },
  cancelBooking(event) {
    const id = String(event.currentTarget.dataset.id);
    if (!id || this.data.actingId) return;
    wx.showModal({
      title: "取消预约",
      content: "确认取消本次预约？符合取消规则时，冻结的1课次会立即退回。",
      success: async (result) => {
        if (!result.confirm) return;
        this.setData({ actingId: `booking-${id}` });
        try {
          await api.cancelOfflineBooking(id);
          wx.showToast({ title: "预约已取消，课次已更新", icon: "none" });
          await this.loadOverview();
        } catch (err) {
          wx.showToast({ title: err.message || "取消失败", icon: "none" });
        } finally {
          this.setData({ actingId: "" });
        }
      }
    });
  },
  onCheckinCodeInput(event) {
    const index = Number(event.currentTarget.dataset.index);
    this.setData({ [`bookings[${index}].code`]: event.detail.value || "" });
  },
  async checkinBooking(event) {
    const id = String(event.currentTarget.dataset.id);
    const index = Number(event.currentTarget.dataset.index);
    const code = String(this.data.bookings[index] && this.data.bookings[index].code || "").trim();
    if (!code) {
      wx.showToast({ title: "请输入老师现场提供的签到码", icon: "none" });
      return;
    }
    if (this.data.actingId) return;
    this.setData({ actingId: `booking-${id}` });
    try {
      await api.checkinOfflineBooking(id, code);
      wx.showToast({ title: "签到成功，已核销1课次", icon: "none" });
      await this.loadOverview();
    } catch (err) {
      wx.showToast({ title: err.message || "签到失败", icon: "none" });
    } finally {
      this.setData({ actingId: "" });
    }
  }
}));
