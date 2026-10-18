function courseAccountKey() {
  if (typeof wx === 'undefined' || typeof wx.getStorageSync !== 'function') return 'guest';
  return wx.getStorageSync('token') ? String(wx.getStorageSync('memberId') || 'signed-in') : 'guest';
}
const { authorizedCourseIds } = require('../../shared/course-access');
const share = require("../../shared/share");
const videoFeature = require("../../shared/video-feature");
const api = require("../../utils/api");
const { popularityText } = require("../../shared/popularity");
const { cleanText, contentText } = require("../../shared/review-text");
const { coursePrice } = require("../../shared/course-price");

const tabs = [
  { key: "all", label: "全部" },
  { key: "online", label: "播放内容" },
  { key: "dance", label: "成品舞" }
];
const mentorKeyword = ["师", "资"].join("");
const hiddenOnlineCategory = ["线", "上", "\u5b66", "\u9662"].join("");
const offlineKeyword = ["培", "训"].join("");

function uniqueById(list) {
  const seen = new Set();
  return list.filter(item => {
    const key = String(item.id || item.name || Math.random());
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function inferType(item) {
  const text = `${item.category || ""}${item.name || ""}${item.subtitle || ""}${item.source_name || ""}`;
  if (item.source_type === "official_dance_collection") return "dance";
  if (/成品舞|作品|编舞|舞蹈/.test(text)) return "dance";
  if (item.source_type === "official_online" || item.category === hiddenOnlineCategory || item.category === "线上学院") return "online";
  if (new RegExp(["线", "上"].join("") + "|网课|" + ["视", "频"].join("") + "|录播").test(text)) return "online";
  if (item.source_type === "platform_offline_course" || item.source_type === "official_offline") return "offline";
  if (new RegExp(`线下|门徒|传承|${mentorKeyword}|${offlineKeyword}|面授|集训|密训|周末`).test(text)) return "offline";
  return "offline";
}

function normalizeCourse(item, rights = new Set()) {
  const type = inferType(item);
  return {
    ...item,
    name: contentText(item.name, "内容"),
    subtitle: contentText(item.subtitle),
    category: contentText(item.category),
    teacher: contentText(item.teacher),
    type,
    badge: type === "dance" ? "舞蹈作品" : "播放内容",
    lessonText: `${item.total_courses || item.course_count || 0} 项内容`,
    learnerText: popularityText(item),
    ...coursePrice(item, rights.has(String(item.id)))
  };
}

Page(share.withShare("system", videoFeature.withVideoFeature({
  data: {
    tabs,
    activeTab: "all",
    loading: true,
    allCourses: [],
    courses: []
  },

  onShow() {
    return this.loadCourses();
  },

  async loadCourses() {
    const account = courseAccountKey();
    this.setData({ loading: true, allCourses: [], courses: [] });
    wx.showLoading({ title: "加载中" });
    try {
      const [list, rights] = await Promise.all([api.getSeriesList(), authorizedCourseIds(api)]);
      if (account !== courseAccountKey()) return this.loadCourses();
      const allCourses = uniqueById((list || []).filter(item => inferType(item) !== "offline")).map(item => normalizeCourse(item, rights));
      this.setData({
        allCourses,
        courses: this.filterCourses(allCourses, this.data.activeTab),
        loading: false
      });
    } catch (err) {
      wx.showToast({ title: err.message || "加载失败", icon: "none" });
      this.setData({ loading: false });
    } finally {
      wx.hideLoading();
    }
  },

  filterCourses(list, key) {
    if (key === "all") return list;
    return list.filter(item => item.type === key);
  },

  switchTab(event) {
    const activeTab = event.currentTarget.dataset.key;
    this.setData({
      activeTab,
      courses: this.filterCourses(this.data.allCourses, activeTab)
    });
  },

  goDetail(event) {
    videoFeature.navigateTo({ url: `/pages/player/player?seriesId=${event.currentTarget.dataset.id}` });
  },

  onImageError(event) {
    const path = event.currentTarget.dataset.path;
    if (path) this.setData({ [path]: "" });
  }
})));
