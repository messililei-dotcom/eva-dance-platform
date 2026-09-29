const share = require("../../shared/share");
const videoFeature = require("../../shared/video-feature");
const api = require("../../utils/api");
const { popularityText } = require("../../shared/popularity");
const { contentText } = require("../../shared/review-text");

function formatDuration(seconds) {
  const value = Number(seconds || 0);
  if (!value) return "待更新";
  const mins = Math.round(value / 60);
  return mins >= 60 ? `${Math.floor(mins / 60)}小时${mins % 60}分` : `${mins}分钟`;
}

Page(share.withShare("detail", videoFeature.withVideoFeature({
  data: {
    id: null, loadError: "",
    series: {},
    courses: [],
    authorized: false
  },

  onLoad(options) {
    this.setData({
      id: options.id
    });

  },

  onShow() { if (this.data.id) return this.loadDetail(this.data.id); },
  retryDetail() { return this.loadDetail(this.data.id); },
  async loadDetail(id) {
    this.setData({ loadError: "" });
    wx.showLoading({ title: "加载中" });
    try {
      const [seriesMeta, courses, auth] = await Promise.all([
        api.getSeriesMeta(id),
        api.getSeriesCourses(id),
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
      this.setData({ series: {}, courses: [], authorized: false, loadError: Number(err.statusCode) === 404 ? "课程已隐藏或下架" : "课程加载失败，请稍后重试" });
      wx.showToast({ title: err.message || "加载失败", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },

  openCourse(event) {
    if (!this.data.videoPlaybackEnabled) return;
    const course = this.data.courses[event.currentTarget.dataset.index];
    if (!course) return;
    const video = (course.videos || [])[0];
    if (!video) {
      wx.showToast({ title: "内容正在整理中", icon: "none" });
      return;
    }
    videoFeature.navigateTo({
      url: `/pages/player/player?videoId=${video.id}&seriesId=${this.data.id}&courseId=${course.id}`
    });
  },

  primaryAction() {
    if (!this.data.videoPlaybackEnabled) return;
    const index = this.data.courses.findIndex(item => item.videos && item.videos.length);
    if (index < 0) return wx.showToast({ title: "内容正在整理中", icon: "none" });
    this.openCourse({ currentTarget: { dataset: { index } } });
  },

  onImageError(event) {
    const path = event.currentTarget.dataset.path;
    if (path) this.setData({ [path]: "" });
  }
})));
