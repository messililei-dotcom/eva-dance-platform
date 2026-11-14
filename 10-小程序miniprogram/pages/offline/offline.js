const { contentText } = require("../../shared/review-text");
const { buildCalendar, swipeMonth } = require("../../shared/offline-calendar");
const share = require("../../shared/share");
const api = require("../../utils/api");
const { formatPrice } = require("../../shared/money-format");
const { groupOfflineCourses } = require("../../shared/offline-catalog");

function cleanDate(value) {
  return String(value || "").slice(0, 10);
}

function courseTitle(item) {
  return [item.course_name || "线下活动", item.course_period].filter(Boolean).join(" · ");
}

function lessonTime(item) {
  const time = [item.start_time, item.end_time].filter(Boolean).join("–");
  return [item.session_date, time].filter(Boolean).join(" ");
}

function locationText(item) {
  return item.classroom || item.address || "活动地点待定";
}

function normalizeCourse(item) {
  return {
    ...item,
    id: item.id,
    name: contentText(item.name, "线下活动"),
    coverImage: item.cover_image || "",
    subtitle: contentText(item.subtitle || item.description || item.category),
    teacherText: item.teacher || "伊娃东方舞导师",
    dateText: item.latestPeriodText === "期次待公布" ? "期次安排待公布" : `最新期次：${item.latestPeriodText}`,
    sessionsText: item.periodText || "1 个期次",
    priceText: Number(item.minPrice || item.price || 0) > 0
      ? `${formatPrice(item.minPrice || item.price)}${item.periodCount > 1 ? "起" : ""}`
      : "咨询价格"
  };
}

function normalizeRight(item) {
  return {
    ...item,
    title: contentText(courseTitle(item)),
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
    courseView: "list",
    calendarYear: new Date().getFullYear(), calendarMonth: new Date().getMonth() + 1,
    calendarWeeks: [], calendarCount: 0, calendarTitle: "",
    weekdays: ["一", "二", "三", "四", "五", "六", "日"],
    courses: [],
    visibleCourses: [],
    bookings: [],
    sessions: [],
    rights: [],
    consumes: [],
    actingId: "",
    availableSessions: 0,
    pendingCount: 0,
    consumedCount: 0,
    tabs: [
      { key: "courses", label: "全部内容" },
      { key: "consumes", label: "核销记录" },
      { key: "rights", label: "我的次数" }
    ]
  },
  onShow() { if (typeof getApp === 'function') { getApp().globalData.lastPublicTab = 'offline'; getApp().globalData.profileLoginCancelled = false; }
    const targetTab = wx.getStorageSync("offlineTargetTab");
    if (targetTab) {
      wx.removeStorageSync("offlineTargetTab");
      this.setData({ activeTab: ["courses","rights","consumes"].includes(targetTab) ? targetTab : "rights" });
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
      this.calendarRows = rows || [];
      this.refreshCalendar();
      const courses = groupOfflineCourses(rows || []).map(normalizeCourse);
      this.setData({ courses, visibleCourses: this.filterCourses(courses, this.data.keyword) });
    } catch (err) {
      this.setData({ courseError: err.message || "内容加载失败，请重试" });
    } finally { this.setData({ loading: false }); }
  },
  async loadOverview() {
    this.setData({ overviewLoading: true, overviewError: "" });
    try {
      const overview = await api.getOfflineOverview(this.data.sessionCourseIds || []);
      const rights = (overview.entitlements || []).map(normalizeRight);
      const consumes = (overview.consumes || []).map(item => ({...item,title:courseTitle(item)}));
      this.setData({ rights, consumes, bookings: [], sessions: [],
        availableSessions: rights.reduce((sum,item)=>sum+item.available,0),
        pendingCount: rights.length, consumedCount: rights.reduce((sum,item)=>sum+item.used,0) });
    } catch (err) {
      this.setData({ overviewError: err.message || "个人次加载失败，请重试" });
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
  switchCourseView(event) { this.setData({ courseView: event.currentTarget.dataset.view }); },
  refreshCalendar() { this.setData(buildCalendar(this.calendarRows || [], this.data.calendarYear, this.data.calendarMonth)); },
  moveCalendar(event) {
    const offset = Number(event.currentTarget.dataset.offset);
    const date = new Date(Date.UTC(this.data.calendarYear, this.data.calendarMonth - 1 + offset, 1));
    this.setData(buildCalendar(this.calendarRows || [], date.getUTCFullYear(), date.getUTCMonth() + 1));
  },
  currentCalendar() { const now = new Date(); this.setData(buildCalendar(this.calendarRows || [], now.getFullYear(), now.getMonth() + 1)); },
  calendarTouchStart(event) {
    this.calendarSuppressUntil = 0;
    this.calendarGesture = event.touches.length === 1 ? { x:event.touches[0].clientX, y:event.touches[0].clientY, axis:null } : null;
  },
  calendarTouchMove(event) {
    const start=this.calendarGesture;
    if (!start || event.touches.length !== 1) { this.calendarGesture=null; return; }
    const dx=Math.abs(event.touches[0].clientX-start.x),dy=Math.abs(event.touches[0].clientY-start.y);
    if (!start.axis && Math.max(dx,dy)>10) start.axis=dx>dy*1.5 ? 'horizontal' : 'vertical';
  },
  calendarTouchCancel() { this.calendarGesture=null; },
  calendarTouchEnd(event) {
    const start=this.calendarGesture;this.calendarGesture=null;
    if (!start || start.axis==='vertical' || event.touches.length || event.changedTouches.length!==1) return;
    const touch=event.changedTouches[0],offset=swipeMonth(touch.clientX-start.x,touch.clientY-start.y);
    if (offset) { this.calendarSuppressUntil=Date.now()+500; this.moveCalendar({currentTarget:{dataset:{offset}}}); }
  },
  openCalendarCourse(event) { if (Date.now() < (this.calendarSuppressUntil || 0)) return; this.openCourse(event); },
  openCourse(event) {
    wx.navigateTo({ url: `/pages/offline-detail/offline-detail?id=${event.currentTarget.dataset.id}` });
  }
}));
