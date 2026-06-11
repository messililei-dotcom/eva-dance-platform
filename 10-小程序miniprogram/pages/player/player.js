const api = require("../../utils/api");
const runtimeConfig = require("../../shared/runtime-config");
const { cleanText } = require("../../shared/review-text");

Page({
  data: {
    videoId: null,
    seriesId: null,
    courseId: null,
    video: {},
    playUrl: "",
    playbackSource: "",
    percent: 0,
    outline: [],
    reviewMode: !!runtimeConfig.reviewMode,
    // 倍速播放
    playbackRate: 1.0,
    rateOptions: [0.5, 0.75, 1.0, 1.25, 1.5, 2.0],
    showPlayerMenu: false,
    qualityOptions: [],
    currentQuality: "auto",
    currentQualityLabel: "自动",
    // 断点续播
    hasResumePosition: false,
    resumeSeconds: 0,
    currentSeconds: 0,
  },

  onLoad(options) {
    if (runtimeConfig.reviewMode) {
      wx.showModal({
        title: "暂未开放",
        content: "当前内容暂不可播放。",
        confirmText: "返回",
        showCancel: false,
        success: () => wx.navigateBack({ delta: 1 })
      });
      return;
    }
    this.videoContext = wx.createVideoContext("courseVideo", this);
    this.setData({
      videoId: options.videoId,
      seriesId: options.seriesId,
      courseId: options.courseId
    });
    this.loadPlayer(options.videoId, options.seriesId);
  },

  async loadPlayer(videoId, seriesId) {
    wx.showLoading({ title: "加载中" });
    try {
      const [video, progress, courses] = await Promise.all([
        api.getVideoPlay(videoId),
        api.getVideoProgress(videoId).catch(() => null),
        api.getSeriesCourses(seriesId).catch(() => [])
      ]);
      const outline = [];
      (courses || []).forEach(course => {
        (course.videos || []).forEach(item => {
          outline.push({
            id: course.id,
            videoId: item.id,
            name: cleanText(item.name || course.name, "内容"),
            duration: Number(item.duration || course.duration || 0),
            progressPercent: 0
          });
        });
      });
      const normalizedVideo = this.normalizeVideo(video || {});
      const currentOutlineItem = outline.find(item => String(item.videoId) === String(videoId));
      const percent = this.getProgressPercent(progress, normalizedVideo.duration || (currentOutlineItem && currentOutlineItem.duration));
      const outlineWithCurrent = outline.map(item => String(item.videoId) === String(videoId)
        ? { ...item, progressPercent: percent }
        : item
      );
      const hasResume = progress && progress.progress > 10;
      const resumeSec = hasResume ? progress.progress : 0;
      
      this.setData({ 
        video: normalizedVideo,
        playUrl: normalizedVideo.playUrl,
        playbackSource: normalizedVideo.playbackSource,
        outline: outlineWithCurrent, 
        percent,
        hasResumePosition: hasResume,
        resumeSeconds: resumeSec,
        qualityOptions: normalizedVideo.qualityOptions,
        currentQuality: normalizedVideo.currentQuality,
        currentQualityLabel: normalizedVideo.currentQualityLabel,
        showPlayerMenu: false,
        currentSeconds: 0
      });
      
      // 自动跳转到上次观看位置
      if (hasResume) {
        setTimeout(() => this.videoContext.seek(resumeSec), 800);
      }
      if (!normalizedVideo.playUrl) {
        wx.showToast({ title: "内容处理中，请稍后再试", icon: "none" });
      }
      this.loadOutlineProgress(outlineWithCurrent, videoId, percent).then(outlineWithProgress => {
        if (String(this.data.videoId) === String(videoId)) {
          this.setData({ outline: outlineWithProgress });
        }
      });
    } catch (err) {
      wx.showToast({ title: err.message || "加载失败", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },

  normalizeVideo(video) {
    const playUrl = video.play_url || video.video_url || video.file_url || video.file_path || video.preview_url || "";
    const playbackSource = video.playback_source || video.source || (video.vod_video_id ? "vod" : "local");
    const qualityOptions = this.normalizeQualityOptions(video, playUrl);
    const selectedQuality = qualityOptions.find(item => item.url === playUrl) || qualityOptions[0];
    const currentQuality = selectedQuality ? selectedQuality.value : "auto";
    return {
      ...video,
      name: cleanText(video.name, "内容详情"),
      playUrl: (selectedQuality && selectedQuality.url) || playUrl,
      playbackSource,
      authorized: video.authorized !== false,
      qualityOptions,
      currentQuality,
      currentQualityLabel: selectedQuality ? selectedQuality.label : "自动",
    };
  },

  normalizeQualityOptions(video, fallbackUrl) {
    const options = [];
    const addOption = (item, index) => {
      if (!item) return;
      const source = typeof item === "string" ? { url: item } : item;
      const url = source.url || source.play_url || source.playUrl || source.video_url || source.file_url || source.file_path || "";
      if (!url) return;
      const rawValue = source.value || source.definition || source.quality || source.key || source.label || source.name || `q${index}`;
      const value = String(rawValue || `q${index}`);
      if (options.some(option => option.value === value || option.url === url)) return;
      options.push({
        label: source.label || source.name || this.getQualityLabel(value, options.length),
        value,
        url
      });
    };

    const list = video.qualities || video.quality_options || video.play_info || video.playInfo || [];
    if (Array.isArray(list)) {
      list.forEach(addOption);
    }

    const urlMap = video.play_urls || video.playUrls || video.quality_urls || video.qualityUrls || {};
    if (urlMap && typeof urlMap === "object" && !Array.isArray(urlMap)) {
      Object.keys(urlMap).forEach((key, index) => addOption({
        value: key,
        label: this.getQualityLabel(key, index),
        url: urlMap[key]
      }, index));
    }

    if (!options.length && fallbackUrl) {
      options.push({ label: "自动", value: "auto", url: fallbackUrl });
    }
    return options;
  },

  getQualityLabel(value, index = 0) {
    const key = String(value || "").toLowerCase();
    const labels = {
      auto: "自动",
      fd: "流畅",
      ld: "流畅",
      sd: "标清",
      hd: "高清",
      od: "原画",
      "2k": "2K",
      "4k": "4K"
    };
    return labels[key] || (index === 0 ? "自动" : String(value).toUpperCase());
  },

  getProgressPercent(progress, fallbackDuration = 0) {
    if (!progress) return 0;
    if (progress.completed) return 100;
    const duration = Number(progress.duration || fallbackDuration || 0);
    const current = Number(progress.progress || 0);
    if (!duration || !current) return 0;
    return Math.min(100, Math.round(current / duration * 100));
  },

  async loadOutlineProgress(outline, currentVideoId, currentPercent) {
    const progressRows = await Promise.all((outline || []).map(item => {
      if (String(item.videoId) === String(currentVideoId)) {
        return Promise.resolve({ item, progressPercent: currentPercent });
      }
      return api.getVideoProgress(item.videoId)
        .then(progress => ({ item, progressPercent: this.getProgressPercent(progress, item.duration) }))
        .catch(() => ({ item, progressPercent: 0 }));
    }));
    return progressRows.map(row => ({
      ...row.item,
      progressPercent: row.progressPercent
    }));
  },

  updateOutlineProgress(videoId, progressPercent) {
    let changed = false;
    const outline = (this.data.outline || []).map(item => {
      if (String(item.videoId) !== String(videoId) || item.progressPercent === progressPercent) return item;
      changed = true;
      return {
        ...item,
        progressPercent
      };
    });
    if (!changed) return;
    this.setData({ outline });
  },

  onTimeUpdate(event) {
    const current = Math.floor(event.detail.currentTime || 0);
    const duration = Math.floor(event.detail.duration || this.data.video.duration || 0);
    const percent = duration ? Math.min(100, Math.round(current / duration * 100)) : 0;
    this.setData({ percent, currentSeconds: current });
    this.updateOutlineProgress(this.data.videoId, percent);
    if (!this.data.video.authorized && current >= (this.data.video.preview_seconds || 30)) {
      this.videoContext.pause();
      this.videoContext.seek(this.data.video.preview_seconds || 30);
      this.requestAuthorization();
      return;
    }
    if (!this.data.video.authorized) return;
    if (!this.lastSaveAt || Date.now() - this.lastSaveAt > 5000) {
      this.lastSaveAt = Date.now();
      api.saveVideoProgress(this.data.videoId, current, duration).catch(() => {});
    }
  },

  onVideoError(event) {
    console.error("内容播放失败", event.detail || event);
    const sourceText = "内容";
    wx.showToast({ title: `${sourceText}暂时无法播放`, icon: "none" });
  },

  onEnded() {
    if (!this.data.video.authorized) {
      this.requestAuthorization();
      return;
    }
    api.saveVideoProgress(this.data.videoId, this.data.video.duration || 1, this.data.video.duration || 1).catch(() => {});
    this.updateOutlineProgress(this.data.videoId, 100);
    wx.showToast({ title: "本段内容已完成", icon: "success" });
  },

  requestAuthorization() {
    wx.showModal({
      title: "内容说明",
      content: "当前内容用于品牌展示与播放。",
      confirmText: "知道了",
      showCancel: false
    });
  },

  replayPreview() {
    this.videoContext.seek(0);
    this.videoContext.play();
  },

  // 从断点续播
  resumeFromPosition() {
    this.videoContext.seek(this.data.resumeSeconds);
    this.videoContext.play();
    this.setData({ hasResumePosition: false });
  },

  // 从头开始
  playFromStart() {
    this.videoContext.seek(0);
    this.videoContext.play();
    this.setData({ hasResumePosition: false });
  },

  switchVideo(event) {
    const videoId = event.currentTarget.dataset.id;
    if (String(videoId) === String(this.data.videoId)) return;
    this.setData({ videoId, percent: 0, hasResumePosition: false, resumeSeconds: 0, showPlayerMenu: false });
    this.loadPlayer(videoId, this.data.seriesId);
  },

  noop() {},

  togglePlayerMenu() {
    this.setData({ showPlayerMenu: !this.data.showPlayerMenu });
  },

  closePlayerMenu() {
    this.setData({ showPlayerMenu: false });
  },

  setQuality(event) {
    const value = String(event.currentTarget.dataset.quality || "");
    const quality = (this.data.qualityOptions || []).find(item => String(item.value) === value);
    if (!quality || !quality.url) {
      this.setData({ showPlayerMenu: false });
      return;
    }
    if (quality.url === this.data.playUrl) {
      this.setData({
        currentQuality: quality.value,
        currentQualityLabel: quality.label,
        showPlayerMenu: false
      });
      return;
    }
    const current = Math.floor(this.data.currentSeconds || 0);
    this.setData({
      playUrl: quality.url,
      currentQuality: quality.value,
      currentQualityLabel: quality.label,
      showPlayerMenu: false
    });
    setTimeout(() => {
      if (current > 0) this.videoContext.seek(current);
      this.videoContext.playbackRate(this.data.playbackRate);
      this.videoContext.play();
    }, 500);
    wx.showToast({ title: `${quality.label} 清晰度`, icon: "none" });
  },

  setRate(event) {
    const rate = parseFloat(event.currentTarget.dataset.rate);
    this.videoContext.playbackRate(rate);
    this.setData({ playbackRate: rate, showPlayerMenu: false });
    wx.showToast({ title: `${rate}x 倍速`, icon: "none" });
  }
});
