const share = require("../../shared/share");
const api = require("../../utils/api");
const { formatPrice } = require("../../shared/money-format");
const anonymousStudents = count => Array.from({ length: Math.min(30, Math.max(0, Number(count) || 0)) }, (_, index) => ({ label: `匿名学员 ${index + 1}` }));
const { findOfflineCourseGroup } = require("../../shared/offline-catalog");

Page(share.withShare("offline-detail", {
  data: {
    loading: true, error: "", courseId: "",
    course: {}
  },
  onLoad(options) {
    this.setData({ courseId: options.id });
  },
  onShow() { if (this.data.courseId) return this.loadCourse(this.data.courseId); },
  retry() { return this.loadCourse(this.data.courseId); },
  async loadCourse(id) {
    this.setData({ loading: true, error: "" });
    try {
      const rows = await api.getOfflineCourses();
      const group = findOfflineCourseGroup(rows || [], id);
      if (!group) throw new Error("线下课程不存在或已下架");
      const source = group.periods.find(item => String(item.id) === String(id)) || group.periods[0];
      const periods = group.periods.map(item => ({
        ...item,
        coverImage: item.cover_image || "",
        anonymous_students: anonymousStudents(item.total_students),
        teacherText: item.teacher || "伊娃东方舞导师",
        statusText: ({ active: "开课中", planned: "待开课", completed: "已结课", inactive: "暂未开放", cancelled: "已取消" })[item.period_status] || item.period_status || "",
        dateText: item.periodLabel,
        sessionsText: `${Number(item.total_courses || 0)} 课次`,
        priceText: Number(item.price || 0) > 0 ? formatPrice(item.price) : "请咨询",
        descriptionText: item.description || item.subtitle || ""
      }));
      const course = {
        ...source,
        coverImage: group.cover_image || "",
        teacherText: source.teacher || "伊娃东方舞导师",
        dateText: group.latestPeriodText,
        sessionsText: group.periodText,
        priceText: Number(group.minPrice || 0) > 0
          ? `${formatPrice(group.minPrice)}${group.periodCount > 1 ? "起" : ""}`
          : "请咨询",
        descriptionText: source.description || source.subtitle || "课程介绍正在完善中，具体安排请联系课程顾问。",
        periodCount: group.periodCount,
        studentCount: group.studentCount,
        anonymousStudents: anonymousStudents(group.studentCount),
        periods
      };
      this.setData({ course, loading: false });
      wx.setNavigationBarTitle({ title: course.name || "线下课程详情" });
    } catch (err) {
      this.setData({ loading: false, error: err.message || "课程加载失败" });
    }
  },
  buyCourse(e){wx.navigateTo({url:`/pages/course-checkout/course-checkout?kind=offline&id=${e.currentTarget.dataset.id}`});},
  openSchedule(event) {
    const selected = event && event.currentTarget && event.currentTarget.dataset.courseId;
    const ids = selected ? [String(selected)] : (this.data.course.periods || []).map(item => String(item.source_id));
    wx.setStorageSync("offlineTargetCourse", { ids, name: this.data.course.name || "" });
    wx.setStorageSync("offlineTargetTab", "rights");
    wx.switchTab({ url: "/pages/offline/offline" });
  },
  onImageError() {
    this.setData({ "course.coverImage": "" });
  }
}));
