function courseAccountKey() {
  if (typeof wx === 'undefined' || typeof wx.getStorageSync !== 'function') return 'guest';
  return wx.getStorageSync('token') ? String(wx.getStorageSync('memberId') || 'signed-in') : 'guest';
}
const { authorizedCourseIds } = require('../../shared/course-access');
const share = require("../../shared/share");
const videoFeature = require("../../shared/video-feature");
const api = require("../../utils/api");
const { popularityText } = require("../../shared/popularity");
const { cleanText } = require("../../shared/review-text");
const { coursePrice } = require("../../shared/course-price");

function normalizeCard(item, rights = new Set()) {
  const lessons = Number(item.total_courses || item.course_count || item.lesson_count || 0);
  return {
    ...item,
    badge: item.category || "线上课程",
    sourceType: "online",
    title: cleanText(item.name, "未命名课程"),
    meta: cleanText(item.subtitle || item.teacher || item.category || "伊娃东方舞线上学院"),
    lessonText: `${lessons}节课程`,
    popularityText: popularityText(item),
    ...coursePrice(item, rights.has(String(item.id)))
  };
}
function uniqueById(list) {
  const seen = new Set();
  return (list || []).filter(item => {
    const key = String(item.id || item.name || "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function normalizeKeyword(value) { return cleanText(value || "").toLowerCase().replace(/\s+/g, ""); }
function filterRows(list, keyword) {
  const query = normalizeKeyword(keyword);
  if (!query) return list;
  return list.filter(item => normalizeKeyword([item.title, item.meta, item.category, item.teacher, item.description].filter(Boolean).join(" ")).includes(query));
}

Page(share.withShare("home", videoFeature.withVideoFeature({
  data: { loading: true, error: "", carouselCourses: [], allCourseRows: [], searchableCourseRows: [], courseRows: [], searchFocused: false, searchKeyword: "", searchCountText: "" },
  onShow() { return this.loadHomeSections(); },
  async loadHomeSections() {
    const account = courseAccountKey();
    this.setData({ loading: true, error: "", allCourseRows: [], searchableCourseRows: [], courseRows: [], carouselCourses: [] });
    try {
      const [list, rights] = await Promise.all([api.getSeriesList(), authorizedCourseIds(api)]);
      if (account !== courseAccountKey()) return this.loadHomeSections();
      const courses = uniqueById(list).map(item => normalizeCard(item, rights));
      const allCourseRows = courses.slice(0, 8);
      this.setData({
        carouselCourses: courses.slice(0, 8),
        allCourseRows,
        searchableCourseRows: courses,
        courseRows: normalizeKeyword(this.data.searchKeyword) ? filterRows(courses, this.data.searchKeyword) : allCourseRows,
        searchCountText: normalizeKeyword(this.data.searchKeyword) ? `找到 ${filterRows(courses, this.data.searchKeyword).length} 门课程` : "",
        loading: false
      });
    } catch (err) {
      this.setData({ loading: false, error: err.message || "课程加载失败，请重试" });
    }
  },
  goSystemCourses() { videoFeature.navigateTo({ url: "/pages/system/system" }); },
  goMyCourses() { wx.switchTab({ url: "/pages/profile/profile" }); },
  goOffline() { wx.switchTab({ url: "/pages/offline/offline" }); },
  goEvents() { wx.switchTab({ url: "/pages/events/events" }); },
  onSearchInput(event) {
    const keyword = event.detail.value || "";
    const rows = normalizeKeyword(keyword) ? filterRows(this.data.searchableCourseRows, keyword) : this.data.allCourseRows;
    this.setData({ searchKeyword: keyword, searchFocused: true, courseRows: rows, searchCountText: normalizeKeyword(keyword) ? `找到 ${rows.length} 门课程` : "" });
  },
  onClearSearch() {
    this.setData({ searchKeyword: "", searchFocused: true, courseRows: this.data.allCourseRows, searchCountText: "" });
  },
  onHide() {
    this.setData({ searchKeyword: "", searchFocused: false, courseRows: this.data.allCourseRows, searchCountText: "" });
  },
  onSearchButtonTap() { if (!normalizeKeyword(this.data.searchKeyword)) return this.setData({ searchFocused: true }); this.onSearchConfirm(); },
  onSearchConfirm() {
    const keyword = normalizeKeyword(this.data.searchKeyword);
    if (!keyword) return this.setData({ searchFocused: true });
    this.setData({ searchFocused: false });
    wx.showToast({ title: this.data.searchCountText || "未找到课程", icon: "none" });
  },
  goCard(event) { videoFeature.navigateTo({ url: `/pages/player/player?seriesId=${event.currentTarget.dataset.id}` }); },
  onImageError(event) { const path = event.currentTarget.dataset.path; if (path) this.setData({ [path]: "" }); }
})));
