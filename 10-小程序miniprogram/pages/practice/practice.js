const api = require("../../utils/api");
const runtimeConfig = require("../../shared/runtime-config");
const { cleanText, contentText } = require("../../shared/review-text");
const { formatPrice } = require("../../shared/money-format");
const hiddenOnlineCategory = ["线", "上", "\u5b66", "\u9662"].join("");
const mentorKeyword = ["师", "资"].join("");

function isDanceSeries(item) {
  const text = `${item.name || ""}${item.category || ""}${item.subtitle || ""}`;
  return /成品舞|经典|情感|国风|道具|民俗|现代融合|古典|作品|编舞/.test(text);
}

function isOfflineSeries(item) {
  const text = `${item.name || ""}${item.category || ""}${item.subtitle || ""}`;
  return new RegExp(`线下|门徒|传承|${mentorKeyword}|集训|密训|周末`).test(text);
}

function onlineGroupScore(item, recentList) {
  const text = `${item.name || ""}${item.category || ""}${item.subtitle || ""}`;
  const recentText = (recentList || [])
    .map(recent => `${recent.series_name || ""}${recent.course_name || ""}${recent.last_video_name || ""}`)
    .join("");
  const progressAvg = recentList && recentList.length
    ? recentList.reduce((sum, recent) => {
      const pct = recent.duration ? (recent.progress || 0) / recent.duration : 0;
      return sum + Math.min(1, pct);
    }, 0) / recentList.length
    : 0;

  let score = Number(item.sort_order || 0) * -1;
  ["零基础", "入门", "基础"].forEach(key => {
    if (progressAvg < 0.35 && text.indexOf(key) >= 0) score += 80;
  });
  ["技巧", "西米", "旋转", "手臂", "甩发", "呼吸", "核心", "S曲线"].forEach(key => {
    if (recentText.indexOf(key) >= 0 && text.indexOf(key) >= 0) score += 60;
  });
  ["编舞", "创编", "音乐", "英语"].forEach(key => {
    if (recentText.indexOf(key) >= 0 && text.indexOf(key) >= 0) score += 50;
  });
  return score + Number(item.total_students || 0) / 1000;
}

function normalizeRecommend(item, source) {
  const price = Number(item.promo_price || item.price || 0);
  return {
    ...item,
    source,
    title: contentText(item.name, "内容"),
    badge: source === "dance" ? "舞蹈作品" : "播放内容",
    meta: contentText(item.subtitle || item.category || "伊娃东方舞"),
    priceText: runtimeConfig.reviewMode ? "咨询" : (item.is_free || price <= 0 ? "可播放" : formatPrice(price))
  };
}

function firstPlayableCourse(courses) {
  return (courses || []).find(item => item.videos && item.videos.length);
}

function playerUrl(videoId, seriesId, courseId) {
  return `/pages/player/player?videoId=${videoId}&seriesId=${seriesId || ""}&courseId=${courseId || ""}`;
}

Page({
  data: {
    recent: null,
    todayPlan: null,
    checkin: { today: false, streak: 0 },
    weekPlan: [],
    recommendedCourses: [],
    recommendHint: "按观看记录推荐内容"
  },

  onLoad() {
    this.refreshCheckin();
    this.loadRecent();
    this.loadRecommendations();
  },

  onShow() {
    this.refreshCheckin();
    this.loadRecent();
    this.loadRecommendations();
  },

  async loadRecent() {
    try {
      const [recentList, authorizedSeries] = await Promise.all([
        api.getRecentCourses().catch(() => []),
        api.getAuthorizedSeries().catch(() => [])
      ]);
      const recent = (recentList || [])[0] || null;
      if (recent) {
        recent.course_name = cleanText(recent.course_name);
        recent.series_name = cleanText(recent.series_name);
        recent.last_video_name = cleanText(recent.last_video_name);
        recent.percent = recent.duration ? Math.min(100, Math.round((recent.progress || 0) / recent.duration * 100)) : 0;
      }
      const firstAuthorized = (authorizedSeries || [])[0] || null;
      const source = recent || firstAuthorized;
      this.setData({
        recent,
        todayPlan: source ? {
          title: recent ? contentText(recent.course_name || recent.series_name, "继续播放") : contentText(firstAuthorized.name, "内容"),
          focus: recent ? "继续播放" : "内容推荐",
          minutes: recent && recent.duration ? Math.max(1, Math.round((recent.duration - (recent.progress || 0)) / 60)) : Math.round(Number(firstAuthorized.total_hours || 0) * 60) || 0,
          desc: recent ? cleanText(recent.last_video_name || recent.series_name || "") : cleanText(firstAuthorized.subtitle || firstAuthorized.category || ""),
          steps: [
            contentText(source.series_name || source.name),
            recent && recent.percent !== undefined ? `已完成 ${recent.percent}%` : `${firstAuthorized.total_courses || firstAuthorized.course_count || 0} 项内容`
          ].filter(Boolean),
          seriesId: recent ? recent.series_id : firstAuthorized.id,
          courseId: recent ? recent.course_id : "",
          videoId: recent ? recent.video_id : ""
        } : null
      });
    } catch (err) {
      this.setData({ recent: null, todayPlan: null });
    }
  },

  async refreshCheckin() {
    const todayKey = this.todayKey();
    const history = await api.getCheckins().catch(() => []);
    const dates = (history || []).map(item => item.checkin_date);
    const today = dates.includes(todayKey);
    const week = ["一", "二", "三", "四", "五", "六", "日"].map((day, index) => ({
      day,
      label: index < 5 ? "播放" : "回看",
      done: dates.includes(this.weekDateKey(index))
    }));
    this.setData({
      checkin: { today, streak: dates.length },
      weekPlan: week
    });
  },

  async loadRecommendations() {
    try {
      const [allSeries, authorizedSeries, recentList] = await Promise.all([
        api.getSeriesList().catch(() => []),
        api.getAuthorizedSeries().catch(() => []),
        api.getRecentCourses().catch(() => [])
      ]);
      const authIds = new Set((authorizedSeries || []).map(item => String(item.id)));
      const published = allSeries || [];
      const online = runtimeConfig.reviewMode ? [] : published.filter(item => item.category === hiddenOnlineCategory);
      const missingOnline = online
        .filter(item => !authIds.has(String(item.id)))
        .sort((a, b) => onlineGroupScore(b, recentList) - onlineGroupScore(a, recentList));

      if (missingOnline.length) {
        this.setData({
          recommendedCourses: missingOnline.slice(0, 2).map(item => normalizeRecommend(item, "online")),
          recommendHint: "按观看记录推荐内容"
        });
        return;
      }

      const dances = published.filter(isDanceSeries).map(item => normalizeRecommend(item, "dance"));
      const nextPool = dances;
      this.setData({
        recommendedCourses: nextPool.slice(0, 2),
        recommendHint: nextPool.length ? "推荐舞蹈作品" : "暂无更多后台推荐"
      });
    } catch (err) {
      this.setData({
        recommendedCourses: [],
        recommendHint: "暂无更多后台推荐"
      });
    }
  },

  todayKey() {
    const d = new Date();
    return this.dateKey(d);
  },

  dateKey(d) {
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const date = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${month}-${date}`;
  },

  weekDateKey(index) {
    const d = new Date();
    const day = d.getDay() || 7;
    d.setDate(d.getDate() - day + index + 1);
    return this.dateKey(d);
  },

  async checkIn() {
    if (this.data.checkin.today) {
      wx.showToast({ title: "今天已经打卡", icon: "none" });
      return;
    }
    try {
      await api.createCheckin();
      wx.showToast({ title: "打卡成功", icon: "success" });
      this.refreshCheckin();
    } catch (err) {
      wx.showToast({ title: err.message || "请先登录", icon: "none" });
    }
  },

  async startToday() {
    const plan = this.data.todayPlan;
    if (plan && plan.videoId) {
      wx.navigateTo({ url: playerUrl(plan.videoId, plan.seriesId, plan.courseId) });
      return;
    }
    if (plan && plan.seriesId) {
      const courses = await api.getSeriesCourses(plan.seriesId).catch(() => []);
      const first = firstPlayableCourse(courses);
      const video = first && first.videos && first.videos[0];
      if (video) {
        wx.navigateTo({ url: playerUrl(video.id, plan.seriesId, first.id) });
        return;
      }
      wx.showToast({ title: "内容正在整理中", icon: "none" });
      return;
    }
    wx.navigateTo({ url: "/pages/system/system" });
  },

  async goRecent() {
    if (!this.data.recent) return;
    const recent = this.data.recent;
    if (recent.video_id) {
      wx.navigateTo({ url: playerUrl(recent.video_id, recent.series_id, recent.course_id) });
      return;
    }
    const courses = await api.getSeriesCourses(recent.series_id).catch(() => []);
    const first = firstPlayableCourse(courses);
    const video = first && first.videos && first.videos[0];
    if (video) {
      wx.navigateTo({ url: playerUrl(video.id, recent.series_id, first.id) });
      return;
    }
    wx.showToast({ title: "内容正在整理中", icon: "none" });
  },

  async goRecommend(event) {
    const { id, source } = event.currentTarget.dataset;
    if (source === "offline") {
      wx.showModal({
        title: "内容说明",
        content: "当前版本仅展示品牌内容。",
        confirmText: "知道了",
        showCancel: false
      });
      return;
    }
    const courses = await api.getSeriesCourses(id).catch(() => []);
    const first = firstPlayableCourse(courses);
    const video = first && first.videos && first.videos[0];
    if (video) {
      wx.navigateTo({ url: playerUrl(video.id, id, first.id) });
      return;
    }
    wx.showToast({ title: "内容正在整理中", icon: "none" });
  },

  showCastGuide() {
    wx.showModal({
      title: "播放提示",
      content: "1. 找一个安静的空间。\n2. 确保网络稳定。\n3. 如需跟随动作，请先做好热身。\n4. 结束后注意放松。",
      confirmText: "知道了",
      showCancel: false
    });
  },

  onImageError(event) {
    const path = event.currentTarget.dataset.path;
    if (path) this.setData({ [path]: "" });
  }
});
