const api = require("../../utils/api");
const runtimeConfig = require("../../shared/runtime-config");
const { popularityText } = require("../../shared/popularity");
const { cleanText, contentText } = require("../../shared/review-text");
const { formatPrice } = require("../../shared/money-format");
const hiddenOnlineCategory = ["线", "上", "\u5b66", "\u9662"].join("");
const offlineKeyword = ["培", "训"].join("");

function shuffle(list) {
  const next = [...list];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function isDanceSeries(item) {
  const category = item.category || "";
  const name = item.name || "";
  if (item.source_type) return item.source_type === "official_dance_collection";
  return item.source_type === "official_dance_collection"
    || /^成品舞[｜|:：]/.test(name)
    || /^(经典成品舞|情感主题|国风|道具舞|民俗舞|现代融合|古典)$/.test(category);
}

function isOnlineSeries(item) {
  if (item.source_type) return item.source_type === "official_online";
  return item.source_type === "official_online" || item.category === hiddenOnlineCategory || item.category === "线上学院";
}

function isOfflineSeries(item) {
  const text = `${item.name || ""} ${item.subtitle || ""} ${item.category || ""} ${item.source_name || ""}`;
  return item.source_type === "platform_offline_course"
    || item.source_type === "official_offline"
    || new RegExp(`线下|${offlineKeyword}|面授|集训`).test(text);
}

function isOfficialOfflineSeries(item) {
  const name = item.name || "";
  const text = `${item.name || ""} ${item.subtitle || ""} ${item.category || ""} ${item.source_name || ""}`;
  return item.source_type === "official_offline"
    || item.source_type === "platform_offline_course"
    || new RegExp(`^(线下训练|线下${offlineKeyword}|线下观看)[｜|:：]`).test(name)
    || new RegExp(`线下|${offlineKeyword}|面授|集训`).test(text);
}

function normalizeCard(item, fallbackBadge, sourceType = "online") {
  const price = Number(item.promo_price || item.price || 0);
  const displayTitle = contentText(item.name || "内容")
    .replace(new RegExp(`^(成品舞|线下内容|线下训练|线下${offlineKeyword}|线下观看)[｜|:：]?\\s*`), "")
    .replace(new RegExp(["课", "程"].join(""), "g"), "内容");
  const lessons = Number(item.total_courses || item.course_count || item.lesson_count || 0);
  return {
    ...item,
    badge: sourceType === "dance" ? "舞蹈作品" : "播放内容",
    sourceType,
    title: displayTitle,
    meta: contentText(item.subtitle || item.category || "伊娃东方舞"),
    lessonText: lessons ? `${lessons}段内容` : "持续更新",
    popularityText: popularityText(item),
    priceText: runtimeConfig.reviewMode ? "咨询" : (item.is_free || price <= 0 ? "可播放" : formatPrice(price))
  };
}

function uniqueById(list) {
  const seen = new Set();
  return list.filter(item => {
    const key = String(item.id || item.name || Math.random());
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function pickCarouselCourses(online, offline, dances, all) {
  const picked = [
    ...shuffle(online).slice(0, 4).map(item => normalizeCard(item, "播放内容", "online")),
    ...shuffle(dances).slice(0, 2).map(item => normalizeCard(item, "成品舞", "dance"))
  ];
  if (picked.length >= 8) return picked.slice(0, 8);
  const fill = shuffle(all)
    .map(item => normalizeCard(item, item.badge || "内容", isOfflineSeries(item) ? "offline" : isDanceSeries(item) ? "dance" : "online"))
    .filter(item => !picked.some(pickedItem => String(pickedItem.id) === String(item.id)));
  return picked.concat(fill).slice(0, 8);
}

function listHomeCourses(online, dances, offline) {
  const picked = uniqueById([
    ...shuffle(online).slice(0, 4).map(item => normalizeCard(item, "播放内容", "online")),
    ...shuffle(dances).slice(0, 2).map(item => normalizeCard(item, "成品舞", "dance"))
  ]);
  const fill = uniqueById([
    ...shuffle(online).map(item => normalizeCard(item, "播放内容", "online")),
    ...shuffle(dances).map(item => normalizeCard(item, "成品舞", "dance"))
  ]).filter(item => !picked.some(pickedItem => String(pickedItem.id) === String(item.id)));
  return picked.concat(fill).slice(0, 8);
}

function listSearchCourses(allCourses) {
  return uniqueById(allCourses.map(item => {
    const sourceType = isDanceSeries(item) ? "dance" : "online";
    const badge = sourceType === "dance" ? "成品舞" : "播放内容";
    return normalizeCard(item, badge, sourceType);
  }));
}

function normalizeSearchKeyword(value) {
  return cleanText(value || "").toLowerCase().replace(/\s+/g, "");
}

function getSearchText(item) {
  return normalizeSearchKeyword([
    item.title,
    item.name,
    item.meta,
    item.subtitle,
    item.teacher,
    item.category,
    item.badge,
    item.description,
    item.source_name,
    item.lessonText,
    item.popularityText
  ].filter(Boolean).join(" "));
}

function filterCourseRows(list, keyword) {
  const query = normalizeSearchKeyword(keyword);
  if (!query) return list;
  return list.filter(item => getSearchText(item).includes(query));
}

Page({
  data: {
    loading: true,
    carouselCourses: [],
    allCourseRows: [],
    searchableCourseRows: [],
    courseRows: [],
    searchFocused: false,
    searchKeyword: "",
    searchCountText: ""
  },

  onLoad() {
    wx.showShareMenu({ withShareTicket: true });
    this.loadHomeSections();
  },

  onShareAppMessage() {
    return {
      title: '伊娃东方舞',
      path: 'pages/home/home',
      imageUrl: '/images/logo.png'
    };
  },

  async loadHomeSections() {
    try {
      const [list, publicStats, config] = await Promise.all([
        api.getSeriesList().catch(() => []),
        api.getHomeStats().catch(() => null),
        api.getMiniAdminConfig().catch(() => null)
      ]);
      const published = list || [];
      const visible = published.filter(item => !isOfflineSeries(item));
      const online = visible.filter(isOnlineSeries);
      const dances = visible.filter(isDanceSeries);
      const allCourses = uniqueById([...online, ...dances, ...visible]);
      void publicStats;
      void config;
      const allCourseRows = listHomeCourses(online, dances, []);
      const searchableCourseRows = listSearchCourses(allCourses);

      this.setData({
        carouselCourses: pickCarouselCourses(online, [], dances, allCourses),
        allCourseRows,
        searchableCourseRows,
        courseRows: this.data.searchKeyword ? filterCourseRows(searchableCourseRows, this.data.searchKeyword) : allCourseRows,
        loading: false
      });
    } catch (err) {
      wx.showToast({ title: err.message || "加载失败", icon: "none" });
      this.setData({ loading: false });
    }
  },

  goSystemCourses() {
    wx.navigateTo({ url: "/pages/system/system" });
  },

  onSearchInput(event) {
    const keyword = event.detail.value || "";
    const query = normalizeSearchKeyword(keyword);
    const courseRows = query ? filterCourseRows(this.data.searchableCourseRows, keyword) : this.data.allCourseRows;
    this.setData({
      searchKeyword: keyword,
      searchFocused: true,
      courseRows,
      searchCountText: query ? `找到 ${courseRows.length} 个内容` : ""
    });
  },

  onSearchButtonTap() {
    if (!normalizeSearchKeyword(this.data.searchKeyword)) {
      this.setData({ searchFocused: true });
      return;
    }
    this.onSearchConfirm();
  },

  onSearchConfirm() {
    const query = normalizeSearchKeyword(this.data.searchKeyword);
    if (!query) {
      this.setData({ searchFocused: true });
      return;
    }
    wx.showToast({ title: this.data.searchCountText || "未找到内容", icon: "none" });
  },

  goMyCourses() {
    wx.switchTab({ url: "/pages/courses/courses" });
  },

  openOfficialHome() {
    wx.navigateTo({ url: "/pages/official/official" });
  },

  goCard(event) {
    const id = event.currentTarget.dataset.id;
    const source = event.currentTarget.dataset.source;
    if (runtimeConfig.reviewMode) {
      wx.showModal({
        title: "内容说明",
        content: "当前内容用于品牌展示与播放。",
        confirmText: "知道了",
        showCancel: false
      });
      return;
    }
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` });
  },

  openBrand() {
    wx.showModal({
      title: "伊娃东方舞",
      content: "首页内容、播放与统计均来自后台数据库。",
      confirmText: "知道了",
      showCancel: false
    });
  },

  goPractice() {
    wx.navigateTo({ url: "/pages/practice/practice" });
  },

  onImageError(event) {
    const path = event.currentTarget.dataset.path;
    if (path) this.setData({ [path]: "" });
  }
});
