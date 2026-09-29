const share = require("../../shared/share");
const videoFeature = require("../../shared/video-feature");
const api = require("../../utils/api");
const { popularityText } = require("../../shared/popularity");
const { cleanText } = require("../../shared/review-text");
const { formatPrice } = require("../../shared/money-format");

function normalizeCard(item) {
  const price = Number(item.promo_price || item.price || 0);
  const lessons = Number(item.total_courses || item.course_count || item.lesson_count || 0);
  return {
    ...item,
    badge: item.category || "线上课程",
    sourceType: "online",
    title: cleanText(item.name, "未命名课程"),
    meta: cleanText(item.subtitle || item.teacher || item.category || "伊娃东方舞线上学院"),
    lessonText: `${lessons}节课程`,
    popularityText: popularityText(item),
    priceText: item.is_free || price <= 0 ? "免费" : formatPrice(price)
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
  data: { loading: true, carouselCourses: [], allCourseRows: [], searchableCourseRows: [], courseRows: [], searchFocused: false, searchKeyword: "", searchCountText: "" },
  onShow() { return this.loadHomeSections(); },
  async loadHomeSections() {
    try {
      const list = await api.getSeriesList().catch(() => []);
      const courses = uniqueById(list).map(normalizeCard);
      const allCourseRows = courses.slice(0, 8);
      this.setData({
        carouselCourses: courses.slice(0, 8),
        allCourseRows,
        searchableCourseRows: courses,
        courseRows: this.data.searchKeyword ? filterRows(courses, this.data.searchKeyword) : allCourseRows,
        loading: false
      });
    } catch (err) {
      this.setData({ loading: false });
      wx.showToast({ title: err.message || "加载失败", icon: "none" });
    }
  },
  goSystemCourses() { videoFeature.navigateTo({ url: "/pages/system/system" }); },
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
