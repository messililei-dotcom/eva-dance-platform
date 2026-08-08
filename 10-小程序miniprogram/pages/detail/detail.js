const api = require("../../utils/api");
const runtimeConfig = require("../../shared/runtime-config");
const { popularityText } = require("../../shared/popularity");
const { cleanText, contentText } = require("../../shared/review-text");

function formatDuration(seconds) {
  const value = Number(seconds || 0);
  if (!value) return "待更新";
  const mins = Math.round(value / 60);
  return mins >= 60 ? `${Math.floor(mins / 60)}小时${mins % 60}分` : `${mins}分钟`;
}

Page({
  data: {
    id: null,
    tab: "intro",
    series: {},
    courses: [],
    authorized: false,
    reviewMode: !!runtimeConfig.reviewMode
  },

  onLoad(options) {
    wx.showShareMenu({ withShareTicket: true });
    this.setData({
      id: options.id
    });
    this.loadDetail(options.id);
  },

  onShareAppMessage() {
    const series = this.data.series || {};
    const origin = (runtimeConfig.apiBase || '').replace(/\/api\/mini\/?$/,'');
    let coverImage = series.cover_image || '';
    // 相对路径转完整URL
    if (coverImage && !/^https?:\/\//.test(coverImage)) {
      coverImage = origin + coverImage;
    }
    const memberId = Number(wx.getStorageSync("memberId") || 0);
    const referralQuery = memberId ? `&ref_member_id=${memberId}` : "";
    return {
      title: series.name || '伊娃东方舞内容',
      path: `pages/detail/detail?id=${this.data.id}${referralQuery}`,
      imageUrl: coverImage || '/images/logo.png'
    };
  },

  async loadDetail(id) {
    wx.showLoading({ title: "加载中" });
    try {
      const [seriesMeta, courses, auth] = await Promise.all([
        api.getSeriesMeta(id).catch(() => ({})),
        api.getSeriesCourses(id).catch(() => []),
        api.checkAuthorization(id).catch(() => ({ authorized: false }))
      ]);
      const meta = seriesMeta || {};
      const authorized = !!auth.authorized || !!meta.is_free;
      const normalizedCourses = (courses || []).map(course => {
        const videos = course.videos || [];
        return {
          ...course,
          name: contentText(course.name, "内容"),
          videos,
          durationText: formatDuration(course.duration || (videos[0] && videos[0].duration)),
          canPlay: videos.length > 0,
          authorized
        };
      });
      this.setData({
        series: Object.assign({}, meta, {
          name: contentText(meta.name, "内容详情"),
          subtitle: contentText(meta.subtitle),
          teacher: contentText(meta.teacher),
          category: contentText(meta.category),
          description: contentText(meta.description),
          popularityText: popularityText(meta)
        }),
        courses: normalizedCourses,
        authorized
      });
    } catch (err) {
      wx.showToast({ title: err.message || "加载失败", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },

  switchTab(event) {
    this.setData({ tab: event.currentTarget.dataset.tab });
  },

  openCourse(event) {
    const course = this.data.courses[event.currentTarget.dataset.index];
    if (!course) return;
    const video = (course.videos || [])[0];
    if (!video) {
      wx.showToast({ title: "内容正在整理中", icon: "none" });
      return;
    }
    wx.navigateTo({
      url: `/pages/player/player?videoId=${video.id}&seriesId=${this.data.id}&courseId=${course.id}`
    });
  },

  primaryAction() {
    if (this.data.reviewMode) {
      this.showReviewContact();
      return;
    }
    if (this.data.authorized || this.data.series.is_free) {
      const first = this.data.courses.find(item => item.videos && item.videos.length);
      if (!first) {
        wx.showToast({ title: "内容正在整理中", icon: "none" });
        return;
      }
      const video = (first.videos || [])[0];
      wx.navigateTo({
        url: `/pages/player/player?videoId=${video.id}&seriesId=${this.data.id}&courseId=${first.id}`
      });
      return;
    }
    const first = this.data.courses.find(item => item.videos && item.videos.length);
    if (first) {
      const video = (first.videos || [])[0];
      wx.navigateTo({
        url: `/pages/player/player?videoId=${video.id}&seriesId=${this.data.id}&courseId=${first.id}`
      });
      return;
    }
    wx.showToast({ title: "内容正在整理中", icon: "none" });
  },

  showReviewContact() {
    wx.showModal({
      title: "内容说明",
      content: "当前内容用于品牌展示与播放。",
      confirmText: "知道了",
      showCancel: false
    });
  },

  onImageError(event) {
    const path = event.currentTarget.dataset.path;
    if (path) this.setData({ [path]: "" });
  }
});
