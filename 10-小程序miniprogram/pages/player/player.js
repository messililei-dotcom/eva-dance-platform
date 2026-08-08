const api = require("../../utils/api");
const { cleanText } = require("../../shared/review-text");
const { findCourseVideoSelection } = require("../../shared/course-video-selection");

Page({
  data: {
    videoId: null, seriesId: null, courseId: null, course: {}, video: {},
    playUrl: "", playbackSource: "", percent: 0, outline: [], visibleOutline: [], activePanel: "catalog",
    notes: [], noteContent: "", savingNote: false, loading: true,
    hasStartedPlayback: false, authorizationRequired: false,
    playbackRate: 1, rateOptions: [0.5, 0.75, 1, 1.25, 1.5, 2],
    showPlayerMenu: false, showVideoControls: false, qualityOptions: [], currentQuality: "auto",
    currentQualityLabel: "自动", resumeSeconds: 0, currentSeconds: 0, currentDuration: 0,
    catalogQuery: "", catalogResultText: "", playbackError: ""
  },
  onLoad(options) {
    this.videoContext = wx.createVideoContext("courseVideo", this);
    this.setData({ videoId: options.videoId || null, seriesId: options.seriesId, courseId: options.courseId });
    this.loadCourse(options.seriesId, options.videoId);
  },
  async loadCourse(seriesId, initialVideoId) {
    wx.showLoading({ title: "加载中" });
    try {
      const [course, courses, progressRows] = await Promise.all([
        api.getSeriesMeta(seriesId).catch(() => ({})),
        api.getSeriesCourses(seriesId).catch(() => []),
        api.getSeriesProgress(seriesId).catch(() => [])
      ]);
      const progressMap = (progressRows || []).reduce((map, row) => { map[String(row.video_id)] = row; return map; }, {});
      const outline = [];
      (courses || []).forEach(courseRow => (courseRow.videos || []).forEach(item => {
        const progress = progressMap[String(item.id)];
        outline.push({
          id: item.id, courseId: courseRow.id, videoId: item.id,
          materialId: item.material_id || item.materialId || null,
          name: cleanText(item.name || courseRow.name, "未命名课时"),
          duration: Number(item.duration || courseRow.duration || 0),
          durationText: this.formatDuration(item.duration || courseRow.duration),
          progressPercent: this.getProgressPercent(progress, item.duration || courseRow.duration),
          lastPlayAt: progress && progress.last_play_at || ""
        });
      }));
      if (!outline.length) {
        this.setData({ course, outline: [], loading: false });
        return wx.showToast({ title: "当前课程暂未配置可播放视频", icon: "none" });
      }
      const requested = findCourseVideoSelection(outline, initialVideoId);
      const resume = outline.filter(item => item.progressPercent > 0).sort((a, b) => String(b.lastPlayAt).localeCompare(String(a.lastPlayAt)))[0];
      const target = requested || resume || outline[0];
      this.setData({
        course, outline, visibleOutline: outline, videoId: target.videoId, courseId: target.courseId,
        video: { id: target.videoId, name: target.name, duration: target.duration },
        percent: target.progressPercent, playUrl: "", loading: false,
        hasStartedPlayback: false, authorizationRequired: false
      });
      if (initialVideoId) await this.loadVideo(target.videoId);
    } catch (err) {
      this.setData({ loading: false });
      wx.showToast({ title: err.message || "加载失败", icon: "none" });
    } finally { wx.hideLoading(); }
  },
  async loadVideo(videoId) {
    wx.showLoading({ title: "加载中" });
    this.clearPlayerControlsTimer();
    this.setData({ videoId, playUrl: "", notes: [], authorizationRequired: false, hasStartedPlayback: true, showPlayerMenu: false, showVideoControls: false, playbackError: "" });
    try {
      const target = (this.data.outline || []).find(item => String(item.videoId) === String(videoId));
      const [video, progress, notes] = await Promise.all([
        api.getVideoPlay(videoId), api.getVideoProgress(videoId).catch(() => null), api.getNotes(videoId).catch(() => [])
      ]);
      const normalizedVideo = this.normalizeVideo(video || {});
      const duration = Number(normalizedVideo.duration || target && target.duration || progress && progress.duration || 0);
      const percent = this.getProgressPercent(progress, duration);
      const resumeSeconds = Number(progress && progress.progress || 0);
      this.setData({
        courseId: target && target.courseId || this.data.courseId, video: normalizedVideo,
        playUrl: normalizedVideo.playUrl, playbackSource: normalizedVideo.playbackSource,
        percent, resumeSeconds, currentSeconds: resumeSeconds, currentDuration: duration,
        notes: this.normalizeNotes(notes), qualityOptions: normalizedVideo.qualityOptions,
        currentQuality: normalizedVideo.currentQuality, currentQualityLabel: normalizedVideo.currentQualityLabel, loading: false
      });
      if (!normalizedVideo.playUrl) throw new Error("当前课节暂未生成播放地址");
      this.updateOutlineProgress(videoId, percent);
      if (resumeSeconds > 3) setTimeout(() => this.videoContext.seek(resumeSeconds), 600);
    } catch (err) {
      const message = err.message || "视频加载失败";
      const authorizationRequired = Number(err && err.statusCode || 0) === 403 || /授权|权限/.test(message);
      this.setData({ loading: false, playUrl: "", authorizationRequired, playbackError: authorizationRequired ? "" : message });
      if (!authorizationRequired) wx.showToast({ title: message, icon: "none" });
    } finally { wx.hideLoading(); }
  },
  formatDuration(value) {
    const seconds = Number(value || 0);
    if (!seconds) return "--:--";
    const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = Math.floor(seconds % 60);
    return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
  },
  formatTimestamp(value) {
    const seconds = Math.max(0, Math.floor(Number(value || 0)));
    const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60;
    return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
  },
  normalizeNotes(notes) {
    return (notes || []).map(item => ({
      ...item,
      timeText: this.formatTimestamp(item.timestamp_seconds || item.timestamp || item.time || 0)
    }));
  },
  normalizeVideo(video) {
    const playUrl = video.play_url || video.video_url || video.file_url || video.file_path || video.preview_url || "";
    const qualityOptions = this.normalizeQualityOptions(video, playUrl);
    const selected = qualityOptions.find(item => item.url === playUrl) || qualityOptions[0];
    return {
      ...video, name: cleanText(video.name, "课程视频"),
      playUrl: selected && selected.url || playUrl,
      playbackSource: video.playback_source || video.source || (video.vod_video_id ? "vod" : "local"),
      authorized: video.authorized !== false, qualityOptions,
      currentQuality: selected ? selected.value : "auto",
      currentQualityLabel: selected ? selected.label : "自动"
    };
  },
  normalizeQualityOptions(video, fallbackUrl) {
    const options = [];
    const add = (item, index) => {
      if (!item) return;
      const source = typeof item === "string" ? { url: item } : item;
      const url = source.url || source.play_url || source.playUrl || source.video_url || source.file_url || source.file_path || "";
      if (!url || options.some(option => option.url === url)) return;
      const value = String(source.value || source.definition || source.quality || source.key || source.label || `q${index}`);
      options.push({ label: source.label || source.name || this.getQualityLabel(value, options.length), value, url });
    };
    const list = video.qualities || video.quality_options || video.play_info || video.playInfo || [];
    if (Array.isArray(list)) list.forEach(add);
    const map = video.play_urls || video.playUrls || video.quality_urls || video.qualityUrls || {};
    if (map && typeof map === "object" && !Array.isArray(map)) Object.keys(map).forEach((key, index) => add({ value: key, label: this.getQualityLabel(key, index), url: map[key] }, index));
    if (!options.length && fallbackUrl) options.push({ label: "自动", value: "auto", url: fallbackUrl });
    return options;
  },
  getQualityLabel(value, index = 0) {
    const labels = { auto: "自动", fd: "流畅", ld: "流畅", sd: "标清", hd: "高清", od: "原画", "2k": "2K", "4k": "4K" };
    return labels[String(value || "").toLowerCase()] || (index === 0 ? "自动" : String(value).toUpperCase());
  },
  getProgressPercent(progress, fallbackDuration = 0) {
    if (!progress) return 0;
    if (progress.completed) return 100;
    const duration = Number(progress.duration || fallbackDuration || 0), current = Number(progress.progress || 0);
    return duration && current ? Math.min(100, Math.round(current / duration * 100)) : 0;
  },
  updateOutlineProgress(videoId, progressPercent) {
    const outline = (this.data.outline || []).map(item => String(item.videoId) === String(videoId) ? { ...item, progressPercent } : item);
    this.setData({ outline, visibleOutline: this.filterOutline(outline, this.data.catalogQuery) });
  },
  onTimeUpdate(event) {
    const current = Math.floor(event.detail.currentTime || 0);
    const duration = Math.floor(event.detail.duration || this.data.video.duration || 0);
    const percent = duration ? Math.min(100, Math.round(current / duration * 100)) : 0;
    this.setData({ percent, currentSeconds: current, currentDuration: duration });
    this.updateOutlineProgress(this.data.videoId, percent);
    if (!this.lastSaveAt || Date.now() - this.lastSaveAt > 15000) {
      this.lastSaveAt = Date.now();
      api.saveVideoProgress(this.data.videoId, current, duration).catch(() => {});
    }
  },
  saveCurrentProgress() {
    const videoId = this.data.videoId, current = Math.floor(this.data.currentSeconds || 0);
    const duration = Math.floor(this.data.currentDuration || this.data.video.duration || 0);
    if (videoId && current && duration) api.saveVideoProgress(videoId, current, duration).catch(() => {});
  },
  onPause() { this.saveCurrentProgress(); },
  onHide() { this.saveCurrentProgress(); },
  onUnload() { this.clearPlayerControlsTimer(); this.saveCurrentProgress(); this.setData({ catalogQuery: "", catalogResultText: "" }); },
  onVideoError(event) { console.error("课程视频播放失败", event.detail || event); wx.showToast({ title: "课程视频暂时无法播放", icon: "none" }); },
  onEnded() {
    const duration = this.data.currentDuration || this.data.video.duration || 1;
    api.saveVideoProgress(this.data.videoId, duration, duration).catch(() => {});
    this.updateOutlineProgress(this.data.videoId, 100);
    wx.showToast({ title: "本节课程已完成", icon: "success" });
  },
  requestAuthorization() {
    wx.showModal({
      title: "课程权限", content: "请联系客服老师申请课程授权：\n海艳老师 153 6787 0529\n伊琳老师 193 1002 9982",
      confirmText: "联系客服", cancelText: "稍后", showCancel: true,
      success: result => {
        if (!result.confirm) return;
        wx.showActionSheet({ itemList: ["海艳老师 153 6787 0529", "伊琳老师 193 1002 9982"], success: ({ tapIndex }) => wx.makePhoneCall({ phoneNumber: ["15367870529", "19310029982"][tapIndex] }) });
      }
    });
  },
  switchVideo(event) {
    const videoId = event.currentTarget.dataset.id;
    if (String(videoId) !== String(this.data.videoId) || !this.data.playUrl) this.loadVideo(videoId);
  },
  startCurrentVideo() {
    if (this.data.videoId) this.loadVideo(this.data.videoId);
  },
  resumePlayback() {
    if (!this.data.playUrl) return this.startCurrentVideo();
    const seconds = Number(this.data.resumeSeconds || this.data.currentSeconds || 0);
    if (seconds > 0) this.videoContext.seek(seconds);
    this.videoContext.play();
  },
  filterOutline(outline, keyword) {
    const query = String(keyword || "").trim().toLowerCase().replace(/\s+/g, "");
    if (!query) return outline || [];
    return (outline || []).filter(item => `${item.name || ""}${item.courseName || ""}`.toLowerCase().replace(/\s+/g, "").includes(query));
  },
  onCatalogSearch(event) {
    const catalogQuery = event.detail.value || "";
    const visibleOutline = this.filterOutline(this.data.outline, catalogQuery);
    this.setData({
      catalogQuery,
      visibleOutline,
      catalogResultText: String(catalogQuery).trim() ? `找到 ${visibleOutline.length} 节` : ""
    });
  },
  clearCatalogSearch() {
    this.setData({ catalogQuery: "", visibleOutline: this.data.outline, catalogResultText: "" });
  },
  switchPanel(event) { this.setData({ activePanel: event.currentTarget.dataset.panel }); },
  onNoteInput(event) { this.setData({ noteContent: event.detail.value || "" }); },
  async addNote() {
    const content = String(this.data.noteContent || "").trim();
    if (!content || !this.data.videoId || this.data.savingNote) return;
    this.setData({ savingNote: true });
    try {
      await api.createNote(this.data.videoId, Math.floor(this.data.currentSeconds || 0), content);
      const notes = await api.getNotes(this.data.videoId).catch(() => []);
      this.setData({ notes: this.normalizeNotes(notes), noteContent: "" });
      wx.showToast({ title: "笔记已保存", icon: "success" });
    } catch (err) { wx.showToast({ title: err.message || "笔记保存失败", icon: "none" }); }
    finally { this.setData({ savingNote: false }); }
  },
  noop() {},
  clearPlayerControlsTimer() {
    if (!this.playerControlsTimer) return;
    clearTimeout(this.playerControlsTimer);
    this.playerControlsTimer = null;
  },
  schedulePlayerControlsHide() {
    this.clearPlayerControlsTimer();
    if (this.data.showPlayerMenu) return;
    this.playerControlsTimer = setTimeout(() => {
      this.setData({ showVideoControls: false });
      this.playerControlsTimer = null;
    }, 3000);
  },
  onPlayerTap() {
    if (this.data.showPlayerMenu) return;
    const showVideoControls = !this.data.showVideoControls;
    this.setData({ showVideoControls });
    if (showVideoControls) this.schedulePlayerControlsHide();
    else this.clearPlayerControlsTimer();
  },
  togglePlayerMenu() {
    const showPlayerMenu = !this.data.showPlayerMenu;
    this.clearPlayerControlsTimer();
    this.setData({ showPlayerMenu, showVideoControls: true });
    if (!showPlayerMenu) this.schedulePlayerControlsHide();
  },
  closePlayerMenu() {
    this.setData({ showPlayerMenu: false });
    this.schedulePlayerControlsHide();
  },
  requestPlayerFullScreen() {
    this.setData({ showPlayerMenu: false, showVideoControls: true });
    this.videoContext.requestFullScreen();
    this.schedulePlayerControlsHide();
  },
  setQuality(event) {
    const quality = (this.data.qualityOptions || []).find(item => String(item.value) === String(event.currentTarget.dataset.quality || ""));
    if (!quality || !quality.url) {
      this.setData({ showPlayerMenu: false });
      this.schedulePlayerControlsHide();
      return;
    }
    const current = Math.floor(this.data.currentSeconds || 0);
    this.setData({ playUrl: quality.url, currentQuality: quality.value, currentQualityLabel: quality.label, showPlayerMenu: false });
    setTimeout(() => { if (current > 0) this.videoContext.seek(current); this.videoContext.playbackRate(this.data.playbackRate); this.videoContext.play(); }, 500);
    this.schedulePlayerControlsHide();
  },
  setRate(event) {
    const rate = parseFloat(event.currentTarget.dataset.rate);
    this.videoContext.playbackRate(rate);
    this.setData({ playbackRate: rate, showPlayerMenu: false });
    this.schedulePlayerControlsHide();
  },
  onVideoPlay() {
    if (this.videoContext && this.videoContext.playbackRate) this.videoContext.playbackRate(this.data.playbackRate);
    this.schedulePlayerControlsHide();
  }
});
