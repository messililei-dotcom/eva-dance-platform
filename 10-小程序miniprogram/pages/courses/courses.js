const api = require("../../utils/api");
const runtimeConfig = require("../../shared/runtime-config");
const { popularityValue } = require("../../shared/popularity");
const { cleanText, contentText } = require("../../shared/review-text");
const { formatPrice } = require("../../shared/money-format");
const imageOrigin = (runtimeConfig.apiBase || "").replace(/\/api\/?$/, "");
const hiddenOnlineCategory = ["线", "上", "\u5b66", "\u9662"].join("");
const offlineKeyword = ["培", "训"].join("");

function uniqueById(list) {
  const seen = new Set();
  return (list || []).filter(item => {
    const key = String(item.id || item.series_id || item.name || "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function clampPercent(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function getProgressPercent(progress, fallbackDuration = 0) {
  if (!progress) return 0;
  if (progress.completed) return 100;
  const existing = progress.percent || progress.progress_percent || progress.progressPercent;
  if (existing !== undefined && Number(existing) <= 100) return clampPercent(existing);
  const duration = Number(progress.duration || fallbackDuration || 0);
  const current = Number(progress.progress || 0);
  if (!duration || !current) return 0;
  return clampPercent((current / duration) * 100);
}

function normalizeCourse(item) {
  const id = item.id || item.series_id;
  const name = item.name || item.series_name;
  const sourceType = getCourseSourceType(item);
  const cover = item.cover_image || "";
  const fullCover = cover && cover.startsWith("/official-images/") ? `${imageOrigin}${cover}` : cover;
  return {
    ...item,
    id,
    name: contentText(name, "内容"),
    subtitle: contentText(item.subtitle),
    category: contentText(item.category),
    teacher: contentText(item.teacher),
    cover_image: fullCover || item.cover_image,
    badge: sourceType === "dance" ? "舞蹈作品" : "播放内容",
    priceText: item.is_free || Number(item.promo_price || item.price || 0) <= 0 ? "可播放" : formatPrice(item.promo_price || item.price),
    courseCount: Number(item.courseCount || item.course_count || item.total_courses || item.lesson_count || 0),
    percent: clampPercent(item.percent || item.progress || item.progress_percent)
  };
}

function isDanceSeries(item) {
  const category = item.category || "";
  const name = item.name || item.series_name || "";
  const text = `${name}${category}${item.subtitle || ""}`;
  return item.source_type === "official_dance_collection"
    || /^成品舞[｜|:：]/.test(name)
    || /^(经典成品舞|情感主题|国风|道具舞|民俗舞|现代融合|古典)$/.test(category)
    || /成品舞|作品|编舞/.test(text);
}

function isOnlineSeries(item) {
  return item.source_type === "official_online"
    || item.category === hiddenOnlineCategory
    || item.category === "线上学院";
}

function isOfflineSeries(item) {
  const text = `${item.name || item.series_name || ""} ${item.subtitle || ""} ${item.category || ""} ${item.source_name || ""}`;
  return item.source_type === "platform_offline_course"
    || item.source_type === "official_offline"
    || new RegExp(`线下|${offlineKeyword}|面授|集训|周末|密训`).test(text);
}

function getCourseSourceType(item) {
  if (isDanceSeries(item)) return "dance";
  if (isOfflineSeries(item)) return "offline";
  return "online";
}

function recommendationScore(item, recentList) {
  const text = `${item.name || ""}${item.category || ""}${item.subtitle || ""}`;
  const recentText = (recentList || [])
    .map(recent => `${recent.series_name || ""}${recent.course_name || ""}${recent.last_video_name || ""}`)
    .join("");
  const progressAvg = recentList && recentList.length
    ? recentList.reduce((sum, recent) => sum + clampPercent(recent.percent) / 100, 0) / recentList.length
    : 0;
  let score = popularityValue(item);
  ["零基础", "入门", "基础"].forEach(key => {
    if (progressAvg < 0.35 && text.indexOf(key) >= 0) score += 80;
  });
  ["技巧", "西米", "旋转", "手臂", "甩发", "呼吸", "核心", "S曲线"].forEach(key => {
    if (recentText.indexOf(key) >= 0 && text.indexOf(key) >= 0) score += 60;
  });
  return score - Number(item.sort_order || 0);
}

function normalizeRecommend(item, sourceType) {
  const normalized = normalizeCourse(item);
  return {
    ...normalized,
    sourceType,
    title: contentText(normalized.name, "内容")
      .replace(new RegExp(`^(成品舞|线下内容|线下训练|线下${offlineKeyword}|线下学习)[｜|:：]?\\s*`), ""),
    meta: contentText(normalized.subtitle || normalized.teacher || normalized.category || "伊娃东方舞"),
    actionText: "查看内容"
  };
}

function buildRecommendedTraining(visibleSeries, offlineCourses, authorizedSeries, recentList) {
  const authorizedIds = new Set((authorizedSeries || []).map(item => String(item.id || item.series_id)));
  const pool = uniqueById([...(visibleSeries || []), ...(offlineCourses || [])])
    .filter(item => !authorizedIds.has(String(item.id || item.series_id)));
  const sortByScore = (a, b) => recommendationScore(b, recentList) - recommendationScore(a, recentList);
  const online = runtimeConfig.reviewMode ? [] : pool.filter(item => isOnlineSeries(item) && !isDanceSeries(item) && !isOfflineSeries(item)).sort(sortByScore);
  const offline = [];
  const dances = pool.filter(item => isDanceSeries(item)).sort(sortByScore);
  const picked = uniqueById([
    ...online.slice(0, 2).map(item => normalizeRecommend(item, "online")),
    ...offline.slice(0, 1).map(item => normalizeRecommend(item, "offline")),
    ...dances.slice(0, 1).map(item => normalizeRecommend(item, "dance"))
  ]);
  const fill = uniqueById([
    ...online.map(item => normalizeRecommend(item, "online")),
    ...offline.map(item => normalizeRecommend(item, "offline")),
    ...dances.map(item => normalizeRecommend(item, "dance")),
    ...pool.sort(sortByScore).map(item => normalizeRecommend(item, getCourseSourceType(item)))
  ]).filter(item => !picked.some(pickedItem => String(pickedItem.id) === String(item.id)));
  return picked.concat(fill).slice(0, 4);
}

function buildCatalogMap(catalog) {
  return (catalog || []).reduce((map, item) => {
    const normalized = normalizeCourse(item);
    if (normalized.id) map[String(normalized.id)] = normalized;
    return map;
  }, {});
}

function mergeAuthorizedSeries(authorized, catalogMap) {
  return (authorized || []).map(item => {
    const id = item.id || item.series_id;
    const catalogItem = catalogMap[String(id)] || {};
    return normalizeCourse({
      ...catalogItem,
      ...item,
      id,
      name: item.name || item.series_name || catalogItem.name,
      cover_image: item.cover_image || catalogItem.cover_image,
      subtitle: item.subtitle || catalogItem.subtitle,
      teacher: item.teacher || catalogItem.teacher,
      category: item.category || catalogItem.category,
      course_count: item.course_count || item.total_courses || catalogItem.courseCount || catalogItem.course_count || catalogItem.total_courses
    });
  });
}

function buildRecentProgressBySeries(recentList) {
  const buckets = {};
  (recentList || []).forEach(item => {
    const seriesId = item.series_id || item.id;
    if (!seriesId) return;
    const percent = clampPercent(item.percent !== undefined
      ? item.percent
      : getProgressPercent(item, item.duration));
    const key = String(seriesId);
    const current = buckets[key] || { total: 0, count: 0 };
    current.total += percent;
    current.count += 1;
    buckets[key] = current;
  });
  return Object.keys(buckets).reduce((map, key) => {
    map[key] = buckets[key].count ? clampPercent(buckets[key].total / buckets[key].count) : 0;
    return map;
  }, {});
}

Page({
  data: {
    authorized: [],
    authorizedTraining: [],
    catalog: [],
    recommendedTraining: []
  },

  onShow() {
    this.loadCourses();
  },

  async loadCourses() {
    wx.showLoading({ title: "加载中" });
    try {
      const [authorized, recent, catalog] = await Promise.all([
        api.getAuthorizedSeries().catch(() => []),
        api.getRecentCourses().catch(() => []),
        api.getSeriesList().catch(() => [])
      ]);
      const normalizedRecent = (recent || []).map(item => ({
        ...item,
        course_name: contentText(item.course_name, "内容"),
        series_name: cleanText(item.series_name, "伊娃东方舞"),
        last_video_name: contentText(item.last_video_name),
        percent: getProgressPercent(item, item.duration)
      }));
      const published = catalog || [];
      const visible = runtimeConfig.reviewMode
        ? published.filter(item => item.category !== hiddenOnlineCategory && !isOfflineSeries(item))
        : published.filter(item => !isOfflineSeries(item));
      const online = visible.filter(item => item.category === hiddenOnlineCategory);
      const catalogData = online.length
        ? online.slice(0, 8).map(normalizeCourse)
        : visible.slice(0, 8).map(normalizeCourse);
      const catalogMap = buildCatalogMap(visible);
      const authorizedData = mergeAuthorizedSeries(authorized, catalogMap);
      const authorizedTraining = await this.buildAuthorizedTraining(authorizedData, normalizedRecent);
      const recommendedTraining = buildRecommendedTraining(visible, [], authorizedData, normalizedRecent);
      this.setData({
        authorized: authorizedData,
        authorizedTraining,
        catalog: catalogData,
        recommendedTraining
      });
    } catch (err) {
      wx.showToast({ title: err.message || "加载失败", icon: "none" });
      this.setData({ catalog: [], authorizedTraining: [], recommendedTraining: [] });
    } finally {
      wx.hideLoading();
    }
  },

  async buildAuthorizedTraining(authorizedData, recentList) {
    const recentProgress = buildRecentProgressBySeries(recentList);
    const list = (authorizedData || []).filter(item => item.id);
    const rows = await Promise.all(list.map(item => this.loadSeriesLearningState(item, recentProgress[String(item.id)] || item.percent || 0)));
    return rows.sort((a, b) => {
      if (a.firstVideoId && !b.firstVideoId) return -1;
      if (!a.firstVideoId && b.firstVideoId) return 1;
      return popularityValue(b) - popularityValue(a);
    });
  },

  async loadSeriesLearningState(series, fallbackPercent) {
    const courses = await api.getSeriesCourses(series.id).catch(() => []);
    const videos = [];
    (courses || []).forEach(course => {
      (course.videos || []).forEach(video => {
        videos.push({
          courseId: course.id,
          videoId: video.id,
          duration: Number(video.duration || course.duration || 0)
        });
      });
    });

    if (!videos.length) {
      return {
        ...series,
        percent: clampPercent(fallbackPercent),
        lessonCount: Number(series.courseCount || series.course_count || series.total_courses || 0),
        actionText: "内容整理中"
      };
    }

    const progressRows = await Promise.all(videos.map(video => (
      api.getVideoProgress(video.videoId).catch(() => null)
    )));
    let totalPercent = 0;
    let finishedCount = 0;
    let firstUnfinished = null;
    progressRows.forEach((progress, index) => {
      const percent = getProgressPercent(progress, videos[index].duration);
      totalPercent += percent;
      if (percent >= 100) finishedCount += 1;
      if (!firstUnfinished && percent < 100) firstUnfinished = videos[index];
    });
    const computedPercent = videos.length ? clampPercent(totalPercent / videos.length) : 0;
    const percent = computedPercent || clampPercent(fallbackPercent);
    const target = firstUnfinished || videos[0];

    return {
      ...series,
      percent,
      lessonCount: videos.length,
      completedLessonCount: finishedCount,
      firstVideoId: target && target.videoId,
      firstCourseId: target && target.courseId,
      actionText: percent > 0 ? "继续播放" : "开始播放"
    };
  },

  goDetail(event) {
    wx.navigateTo({ url: `/pages/detail/detail?id=${event.currentTarget.dataset.id}` });
  },

  openAuthorizedCourse(event) {
    const id = String(event.currentTarget.dataset.id || "");
    const course = (this.data.authorizedTraining || []).find(item => String(item.id) === id);
    if (!course || !course.firstVideoId) {
      wx.showToast({ title: "内容正在整理中", icon: "none" });
      return;
    }
    wx.navigateTo({
      url: `/pages/player/player?videoId=${course.firstVideoId}&seriesId=${course.id}&courseId=${course.firstCourseId || ""}`
    });
  },

  goSystem() {
    wx.navigateTo({ url: "/pages/system/system" });
  },

  goRecommend(event) {
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
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` });
  },

  onImageError(event) {
    const path = event.currentTarget.dataset.path;
    if (path) this.setData({ [path]: "" });
  }
});
