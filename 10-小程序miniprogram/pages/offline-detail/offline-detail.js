const api = require("../../utils/api");
const { formatPrice } = require("../../shared/money-format");
const { findOfflineCourseGroup } = require("../../shared/offline-catalog");

Page({
  data: {
    loading: true,
    course: {}
  },
  onLoad(options) {
    this.loadCourse(options.id);
  },
  async loadCourse(id) {
    try {
      const rows = await api.getOfflineCourses();
      const group = findOfflineCourseGroup(rows || [], id);
      if (!group) throw new Error("线下课程不存在或已下架");
      const source = group.periods[0];
      const periods = group.periods.map(item => ({
        ...item,
        coverImage: item.cover_image || "",
        teacherText: item.teacher || "伊娃东方舞导师",
        dateText: item.periodLabel,
        sessionsText: `${Number(item.total_courses || 0)} 课次`,
        priceText: Number(item.price || 0) > 0 ? formatPrice(item.price) : "请咨询",
        descriptionText: item.description || item.subtitle || ""
      }));
      const course = {
        ...source,
        coverImage: source.cover_image || "",
        teacherText: source.teacher || "伊娃东方舞导师",
        dateText: group.latestPeriodText,
        sessionsText: group.periodText,
        priceText: Number(group.minPrice || 0) > 0
          ? `${formatPrice(group.minPrice)}${group.periodCount > 1 ? "起" : ""}`
          : "请咨询",
        descriptionText: source.description || source.subtitle || "课程介绍正在完善中，具体安排请联系课程顾问。",
        periodCount: group.periodCount,
        periods
      };
      this.setData({ course, loading: false });
      wx.setNavigationBarTitle({ title: course.name || "线下课程详情" });
    } catch (err) {
      this.setData({ loading: false });
      wx.showToast({ title: err.message || "课程加载失败", icon: "none" });
    }
  },
  openSchedule() {
    wx.setStorageSync("offlineTargetTab", "sessions");
    wx.switchTab({ url: "/pages/offline/offline" });
  },
  onImageError() {
    this.setData({ "course.coverImage": "" });
  }
});
