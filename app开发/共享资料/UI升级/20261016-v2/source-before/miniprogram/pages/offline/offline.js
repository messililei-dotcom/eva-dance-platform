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
    consumes: [],
    actingId: "",
    availableSessions: 0,
    pendingCount: 0,
    consumedCount: 0,
    tabs: [
      { key: "courses", label: "全部课程" },
      { key: "consumes", label: "核销记录" },
      { key: "rights", label: "我的课时" }
    ]
  },
  onShow() {
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
      const rights = (overview.entitlements || []).map(normalizeRight);
      const consumes = (overview.consumes || []).map(item => ({...item,title:courseTitle(item)}));
      this.setData({ rights, consumes, bookings: [], sessions: [],
        availableSessions: rights.reduce((sum,item)=>sum+item.available,0),
        pendingCount: rights.length, consumedCount: rights.reduce((sum,item)=>sum+item.used,0) });
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
  }
}));
