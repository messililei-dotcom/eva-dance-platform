const { filterCatalog, categories } = require('../../shared/catalog-view');
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

Page(share.withShare("home", videoFeature.withVideoFeature({
  data: { loading: true, error: "", carouselCourses: [], searchableCourseRows: [], courseRows: [], searchFocused: false, searchKeyword: "", searchCountText: "", categories: ["全部"], activeCategory: "全部", unlockedOnly: false },
  onShow() {
    if (typeof getApp === 'function') { getApp().globalData.lastPublicTab = 'home'; getApp().globalData.profileLoginCancelled = false; }
    if (this.pendingUnlocked) { this.setData({ unlockedOnly: !!wx.getStorageSync('token') }); this.pendingUnlocked = false; }
    return this.loadHomeSections();
  },
  onPullDownRefresh() { return this.loadHomeSections().finally(() => wx.stopPullDownRefresh()); },
  onUnload() { this.homeRequestId = (this.homeRequestId || 0) + 1; },
  async loadHomeSections() {
    const account = courseAccountKey();
    const requestId = this.homeRequestId = (this.homeRequestId || 0) + 1;
    this.setData({ loading: true, error: "", searchableCourseRows: [], courseRows: [], carouselCourses: [] });
    try {
      const [list, rights] = await Promise.all([api.getSeriesList(), authorizedCourseIds(api)]);
      if (requestId !== this.homeRequestId) return;
      if (account !== courseAccountKey()) return this.loadHomeSections();
      const courses = uniqueById(list).map(item => normalizeCard(item, rights));
      this.setData({
        carouselCourses: courses.slice(0, 8),
        searchableCourseRows: courses, categories: categories(courses),
        ...this.courseFilterData(courses),
        loading: false
      });
    } catch (err) {
      if (requestId !== this.homeRequestId || account !== courseAccountKey()) return;
      this.setData({ loading: false, error: err.message || "课程加载失败，请重试" });
    }
  },
  goSystemCourses() { videoFeature.navigateTo({ url: "/pages/system/system" }); },
  goMyCourses() { wx.switchTab({ url: "/pages/profile/profile" }); },
  goOffline() { wx.switchTab({ url: "/pages/offline/offline" }); },
  goEvents() { wx.switchTab({ url: "/pages/events/events" }); },
  courseFilterData(rows) {
    const filtered = filterCatalog(rows, { keyword: this.data.searchKeyword, category: this.data.activeCategory, unlockedOnly: this.data.unlockedOnly });
    const filtering = !!normalizeKeyword(this.data.searchKeyword) || this.data.activeCategory !== '全部' || this.data.unlockedOnly;
    return { courseRows: filtering ? filtered : filtered.slice(0, 8), searchCountText: filtering ? `找到 ${filtered.length} 门课程` : '' };
  },
  applyCourseFilters() { this.setData(this.courseFilterData(this.data.searchableCourseRows)); },
  switchCategory(event) { this.setData({ activeCategory: event.currentTarget.dataset.category }); this.applyCourseFilters(); },
  toggleUnlocked() {
    if (!wx.getStorageSync('token')) { this.pendingUnlocked = true; return wx.navigateTo({ url: '/pages/login/login' }); }
    this.setData({ unlockedOnly: !this.data.unlockedOnly }); this.applyCourseFilters();
  },
  onSearchInput(event) { this.setData({ searchKeyword: event.detail.value || '', searchFocused: true }); this.applyCourseFilters(); },
  onClearSearch() { this.setData({ searchKeyword: '', searchFocused: true }); this.applyCourseFilters(); },
  onSearchButtonTap() { if (!normalizeKeyword(this.data.searchKeyword)) return this.setData({ searchFocused: true }); this.onSearchConfirm(); },
  onSearchConfirm() {
    const keyword = normalizeKeyword(this.data.searchKeyword);
    if (!keyword) return this.setData({ searchFocused: true });
    this.setData({ searchFocused: false });
    if (wx.hideKeyboard) wx.hideKeyboard();
    wx.showToast({ title: this.data.searchCountText || "未找到课程", icon: "none" });
  },
  goCard(event) { videoFeature.navigateTo({ url: `/pages/player/player?seriesId=${event.currentTarget.dataset.id}` }); },
  onImageError(event) { const path = event.currentTarget.dataset.path; if (path) this.setData({ [path]: "" }); }
})));
