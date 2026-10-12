const share = require("../../shared/share");
const videoFeature = require("../../shared/video-feature");
const api = require("../../utils/api");
const { cleanText } = require("../../shared/review-text");
const { findCourseVideoSelection } = require("../../shared/course-video-selection");

Page(share.withShare("player", videoFeature.withVideoFeature({
  data: {
    isPlayerFullscreen: false, isMirrored: false, isMuted: false, isPlaying: false,
    playerMenu: "",
    currentTimeText: "0:00", durationText: "0:00", hasPrevious: false, hasNext: false,
    videoId: null, seriesId: null, courseId: null, course: {}, video: {},
    playUrl: "", playbackSource: "", percent: 0, outline: [], visibleOutline: [], activePanel: "catalog",
    autoplayCountdown: null, lessonEnded: false,
    notes: [], noteContent: "", savingNote: false, loading: true,
    hasStartedPlayback: false, authorizationRequired: false,
    playbackRate: 1, rateOptions: [0.75, 1, 1.25, 2],
    showPlayerMenu: false, showVideoControls: false, qualityOptions: [], currentQuality: "auto",
    currentQualityLabel: "自动", resumeSeconds: 0, currentSeconds: 0, currentDuration: 0,
    catalogPage: 1, catalogPageCount: 1, catalogTotal: 0, catalogFrom: 0, catalogTo: 0,
    catalogQuery: "", catalogResultText: "", playbackError: ""
  },
  async onLoad(options) {
    this.setData({ videoId: options.videoId || null, seriesId: options.seriesId, courseId: options.courseId });
    const active = await videoFeature.enabled();
    this.setData({ videoPlaybackEnabled: active });
    if (!active) { this.setData({ loading: false }); return; }
    this.videoContext = wx.createVideoContext("courseVideo", this);
    this.loadCourse(options.seriesId, options.videoId);
  },
  async onShow() {
    if (!this.catalogLoaded || !this.data.seriesId) return;
    try { await this.refreshCourseCatalog(); }
    catch (err) {
      if (Number(err.statusCode) !== 404) return;
      this.videoLoadRequestId = (this.videoLoadRequestId || 0) + 1;
      if (this.videoContext) this.videoContext.stop();
      this.setData({ course: {}, video: {}, videoId: null, outline: [], visibleOutline: [], playUrl: '', hasStartedPlayback: false, playbackError: '课程已隐藏或下架' });
    }
  },
  async refreshCourseCatalog() {
    const seriesId = this.data.seriesId;
    const [course, courses] = await Promise.all([api.getSeriesMeta(seriesId), api.getSeriesCourses(seriesId)]);
    if (String(seriesId) !== String(this.data.seriesId) || this.catalogDisposed) return;
    const previous = new Map((this.data.outline || []).map(item => [String(item.videoId), item]));
    const outline = [];
    (courses || []).forEach(row => (row.videos || []).forEach(item => {
      outline.push({
        ...(previous.get(String(item.id)) || {}),
        id: item.id, courseId: row.id, videoId: item.id, ordinal: outline.length + 1,
        materialId: item.material_id || item.materialId || null,
        name: cleanText(row.name || item.name, "未命名课时"),
        duration: Number(item.duration || row.duration || 0),
        durationText: this.formatDuration(item.duration || row.duration)
      });
    }));
    const index = outline.findIndex(item => String(item.videoId) === String(this.data.videoId));
    const selected = outline[index];
    this.setData({ course, outline, hasPrevious: index > 0, hasNext: index >= 0 && index < outline.length - 1 });
    if (selected) this.setData({ courseId: selected.courseId, 'video.name': selected.name });
    else if (this.data.videoId) {
      this.videoLoadRequestId = (this.videoLoadRequestId || 0) + 1;
      this.cancelAutoplay();
      if (this.videoContext) this.videoContext.stop();
      this.setData({ videoId: null, video: {}, playUrl: '', hasStartedPlayback: false, playbackError: '当前课节已下架，请选择其他课节' });
    }
    this.refreshCatalog();
  },
  async loadCourse(seriesId, initialVideoId) {
    wx.showLoading({ title: "加载中" });
    try {
      const [course, courses, progressRows] = await Promise.all([
        api.getSeriesMeta(seriesId),
        api.getSeriesCourses(seriesId),
        api.getSeriesProgress(seriesId).catch(() => [])
      ]);
      this.catalogLoaded = true;
      const progressMap = (progressRows || []).reduce((map, row) => { map[String(row.video_id)] = row; return map; }, {});
      const outline = [];
      (courses || []).forEach(courseRow => (courseRow.videos || []).forEach(item => {
        const progress = progressMap[String(item.id)];
        outline.push({
          id: item.id, courseId: courseRow.id, videoId: item.id, ordinal: outline.length + 1,
          materialId: item.material_id || item.materialId || null,
          name: cleanText(courseRow.name || item.name, "未命名课时"),
          duration: Number(item.duration || courseRow.duration || 0),
          durationText: this.formatDuration(item.duration || courseRow.duration),
          progressPercent: this.getProgressPercent(progress, item.duration || courseRow.duration),
          resumeSeconds: this.getResumeSeconds(progress, item.duration || courseRow.duration),
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
        resumeSeconds: target.resumeSeconds, currentSeconds: 0, currentDuration: target.duration,
        currentTimeText: this.formatTimestamp(target.resumeSeconds), durationText: this.formatTimestamp(target.duration),
        hasStartedPlayback: false, authorizationRequired: false
      });
      this.refreshCatalog(true);
      // Entering a course only prepares the catalog; playback requires a user action.
    } catch (err) {
      this.setData({ course: {}, outline: [], visibleOutline: [], video: {}, videoId: null, playUrl: "", loading: false, playbackError: Number(err.statusCode) === 404 ? "课程已隐藏或下架" : "课程加载失败，请稍后重试" });
      wx.showToast({ title: err.message || "加载失败", icon: "none" });
    } finally { wx.hideLoading(); }
  },
  async loadVideo(videoId) {
    this.cancelAutoplay();
    this.setData({ lessonEnded: false });
    const requestId = this.videoLoadRequestId = (this.videoLoadRequestId || 0) + 1;
    const active = await videoFeature.enabled();
    if (requestId !== this.videoLoadRequestId) return;
    if (!active) {
      if (this.videoContext) this.videoContext.stop();
      this.setData({ videoPlaybackEnabled: false, playUrl: "", hasStartedPlayback: false });
      return;
    }
    wx.showLoading({ title: "加载中" });
    this.clearPlayerControlsTimer();
    const index = this.data.outline.findIndex(row => String(row.videoId) === String(videoId));
    this.setData({ hasPrevious: index > 0, hasNext: index >= 0 && index < this.data.outline.length - 1 });
    const selected = this.data.outline[index];
    if (selected) this.setData({ courseId: selected.courseId, video: { id: selected.videoId, name: selected.name, duration: selected.duration } });
    this.setData({ videoId, playUrl: "", currentSeconds: 0, resumeSeconds: 0, notes: [], authorizationRequired: false, hasStartedPlayback: true, showPlayerMenu: false, showVideoControls: false, playbackError: "" });
    this.refreshCatalog(true);
    try {
      const target = (this.data.outline || []).find(item => String(item.videoId) === String(videoId));
      const [video, progress, notes] = await Promise.all([
        api.getVideoPlay(videoId), api.getVideoProgress(videoId).catch(() => null), api.getNotes(videoId).catch(() => [])
      ]);
      if (requestId !== this.videoLoadRequestId) return;
      const normalizedVideo = this.normalizeVideo({ ...video, name: target && target.name || video && video.name });
      const duration = Number(normalizedVideo.duration || target && target.duration || progress && progress.duration || 0);
      const percent = this.getProgressPercent(progress, duration);
      const resumeSeconds = this.getResumeSeconds(progress, duration);
      this.setData({
        courseId: target && target.courseId || this.data.courseId, video: normalizedVideo,
        playUrl: normalizedVideo.playUrl, playbackSource: normalizedVideo.playbackSource,
        percent, resumeSeconds, currentSeconds: resumeSeconds, currentDuration: duration,
        currentTimeText: this.formatTimestamp(resumeSeconds), durationText: this.formatTimestamp(duration),
        notes: this.normalizeNotes(notes), qualityOptions: normalizedVideo.qualityOptions,
        currentQuality: normalizedVideo.currentQuality, currentQualityLabel: normalizedVideo.currentQualityLabel, loading: false
      });
      if (!normalizedVideo.playUrl) throw new Error("当前课节暂未生成播放地址");
      this.updateOutlineProgress(videoId, percent);

    } catch (err) {
      if (requestId !== this.videoLoadRequestId) return;
      const message = err.message || "视频加载失败";
      if (/视频播放暂未开放/.test(message)) {
        this.videoContext.stop();
        this.setData({ videoPlaybackEnabled: false, playUrl: "", hasStartedPlayback: false });
        return;
      }
      const authorizationRequired = Number(err && err.statusCode || 0) === 403 || /授权|权限/.test(message);
      this.setData({ loading: false, playUrl: "", authorizationRequired, playbackError: authorizationRequired ? "" : message });
      if (!authorizationRequired) wx.showToast({ title: message, icon: "none" });
    } finally { if (requestId === this.videoLoadRequestId) wx.hideLoading(); }
  },
  requestCasting() {
    if (!this.data.playUrl) return;
    const video = this.videoContext || wx.createVideoContext('courseVideo', this);
    if (typeof video.startCasting !== 'function') {
      wx.showModal({ title: '投屏', content: '请更新微信后重试，或使用手机系统的无线投屏。手机和电视需连接同一 Wi-Fi。', showCancel: false });
      return;
    }
    try {
      // Must be called directly in the tap handler to open WeChat's device picker.
      video.startCasting();
    } catch (error) {
      wx.showModal({ title: '投屏', content: '暂时无法打开投屏，请检查手机和电视已连接同一 Wi-Fi 后重试。', showCancel: false });
    }
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
      authorText: item.member_name || '学员',
      createdText: String(item.created_at || '').replace('T', ' ').slice(0,16),
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
    if (progress.completed === true || Number(progress.completed) === 1) return 100;
    const duration = Number(progress.duration || fallbackDuration || 0), current = Number(progress.progress || 0);
    return duration && current ? Math.min(100, Math.round(current / duration * 100)) : 0;
  },
  getResumeSeconds(progress, duration = 0) {
    if (!progress || this.getProgressPercent(progress, duration) >= 100) return 0;
    const seconds = Number(progress.progress || 0);
    return Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  },
  updateOutlineProgress(videoId, progressPercent) {
    const outline = (this.data.outline || []).map(item => String(item.videoId) === String(videoId) ? { ...item, progressPercent } : item);
    this.setData({ outline });
    this.refreshCatalog();
  },
  onTimeUpdate(event) {
    const current = Math.floor(event.detail.currentTime || 0);
    const duration = Math.floor(event.detail.duration || this.data.video.duration || 0);
    const percent = duration ? Math.min(100, Math.round(current / duration * 100)) : 0;
    this.setData({ percent, currentSeconds: current, currentDuration: duration, currentTimeText: this.formatTimestamp(current), durationText: this.formatTimestamp(duration) });
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
  onPause() { this.setData({ isPlaying: false }); this.saveCurrentProgress(); },
  onHide() { this.cancelAutoplay(); this.clearPlayerControlsTimer(); this.setData({ showVideoControls: false, showPlayerMenu: false }); this.saveCurrentProgress(); },
  onUnload() { this.catalogDisposed = true; this.cancelAutoplay(); this.videoLoadRequestId = (this.videoLoadRequestId || 0) + 1; this.clearPlayerControlsTimer(); this.saveCurrentProgress(); this.setData({ catalogQuery: "", catalogResultText: "" }); },
  onVideoError(event) { this.cancelAutoplay(); console.error("课程视频播放失败", event.detail || event); wx.showToast({ title: "课程视频暂时无法播放", icon: "none" }); },
  onEnded() {
    const duration = this.data.currentDuration || this.data.video.duration || 1;
    api.saveVideoProgress(this.data.videoId, duration, duration).catch(() => {});
    this.updateOutlineProgress(this.data.videoId, 100);
    this.setData({ isPlaying: false, currentSeconds: 0, resumeSeconds: 0, percent: 100, currentTimeText: "0:00" });
    const index = this.data.outline.findIndex(row => String(row.videoId) === String(this.data.videoId));
    const next = index >= 0 ? this.data.outline[index + 1] : null;
    this.setData({ lessonEnded: true, showVideoControls: true });
    if (next) this.startAutoplayCountdown(next);
    else this.cancelAutoplay();
  },
  cancelAutoplay() {
    if (this.autoplayTimer) clearTimeout(this.autoplayTimer);
    this.autoplayTimer = null;
    this.setData({ autoplayCountdown: null });
  },
  startAutoplayCountdown(target) {
    this.cancelAutoplay();
    this.setData({ autoplayCountdown: { seconds: 5, videoId: target.videoId, name: target.name || '本节课程' }, showVideoControls: true });
    const tick = () => {
      const pending = this.data.autoplayCountdown;
      if (!pending) return;
      if (pending.seconds > 1) {
        this.setData({ autoplayCountdown: { ...pending, seconds: pending.seconds - 1 } });
        this.autoplayTimer = setTimeout(tick, 1000);
      } else {
        this.cancelAutoplay();
        this.setData({ lessonEnded: false });
        this.loadVideo(target.videoId);
      }
    };
    this.autoplayTimer = setTimeout(tick, 1000);
  },
  replayLesson() {
    this.cancelAutoplay();
    this.setData({ lessonEnded: false, resumeSeconds: 0, currentSeconds: 0, currentTimeText: '0:00', percent: 0 });
    this.scrollToPlayer();
    this.videoContext.seek(0);
    this.videoContext.play();
  },
  async seekToNote(event) {
    const note = this.data.notes.find(item => String(item.id) === String(event.currentTarget.dataset.id));
    if (!note) return;
    const seconds = Math.max(0, Number(note.timestamp_seconds ?? note.timestamp ?? note.time ?? 0) || 0);
    this.cancelAutoplay();
    this.setData({ lessonEnded: false });
    this.scrollToPlayer();
    if (!this.data.playUrl) await this.loadVideo(this.data.videoId);
    if (!this.data.playUrl || !this.videoContext) return;
    const position = this.data.currentDuration ? Math.min(seconds, this.data.currentDuration) : seconds;
    this.videoContext.seek(position);
    this.setData({ currentSeconds: position, currentTimeText: this.formatTimestamp(position) });
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
    if (String(videoId) !== String(this.data.videoId) || !this.data.playUrl || this.data.percent >= 100) { this.scrollToPlayer(); this.saveCurrentProgress(); this.loadVideo(videoId); }
    else this.resumePlayback();
  },
  startCurrentVideo() {
    if (this.data.videoId) { this.scrollToPlayer(); this.loadVideo(this.data.videoId); }
    else if (this.data.seriesId) this.loadCourse(this.data.seriesId, this.shareOptions && this.shareOptions.videoId);
  },
  resumePlayback() {
    this.cancelAutoplay();
    if (!this.data.playUrl) return this.startCurrentVideo();
    this.scrollToPlayer();
    const completed = this.data.percent >= 100;
    const seconds = completed ? 0 : Number(this.data.currentSeconds ?? this.data.resumeSeconds ?? 0);
    if (completed || seconds > 0) this.videoContext.seek(seconds);
    this.videoContext.play();
  },
  filterOutline(outline, keyword) {
    const query = String(keyword || "").trim().toLowerCase().replace(/\s+/g, "");
    if (!query) return outline || [];
    return (outline || []).filter(item => `${item.name || ""}${item.courseName || ""}`.toLowerCase().replace(/\s+/g, "").includes(query));
  },
  refreshCatalog(focusCurrent = false) {
    const rows = this.filterOutline(this.data.outline, this.data.catalogQuery);
    const pageCount = Math.max(1, Math.ceil(rows.length / 50));
    let page = this.data.catalogPage || 1;
    if (focusCurrent) {
      const index = rows.findIndex(row => String(row.videoId) === String(this.data.videoId));
      if (index >= 0) page = Math.floor(index / 50) + 1;
    }
    page = Math.max(1, Math.min(pageCount, page));
    const start = (page - 1) * 50;
    this.setData({ catalogPage: page, catalogPageCount: pageCount, catalogTotal: rows.length,
      catalogFrom: rows.length ? start + 1 : 0, catalogTo: Math.min(rows.length, start + 50),
      visibleOutline: rows.slice(start, start + 50),
      catalogResultText: String(this.data.catalogQuery || '').trim() ? `找到 ${rows.length} 节` : '' });
  },
  changeCatalogPage(event) {
    const offset = Number(event.currentTarget.dataset.offset);
    if (offset !== -1 && offset !== 1) return;
    const page = Math.max(1, Math.min(this.data.catalogPageCount, this.data.catalogPage + offset));
    if (page === this.data.catalogPage) return;
    this.setData({ catalogPage: page });
    this.refreshCatalog();
    if (event.currentTarget.dataset.position === 'bottom' && typeof wx.pageScrollTo === 'function') {
      this.setData({}, () => wx.pageScrollTo({ selector: '#courseCatalog', duration: 0 }));
    }
  },
  scrollToPlayer() {
    if (!this.data.isPlayerFullscreen && typeof wx.pageScrollTo === 'function') wx.pageScrollTo({ scrollTop: 0, duration: 0 });
  },
  onCatalogSearch(event) {
    this.setData({ catalogQuery: event.detail.value || '', catalogPage: 1 });
    this.refreshCatalog();
  },
  clearCatalogSearch() {
    this.setData({ catalogQuery: '', catalogPage: 1 });
    this.refreshCatalog(true);
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
  togglePlayerMenu(event) {
    const menu = event && event.currentTarget.dataset.menu || 'quality';
    const showPlayerMenu = !this.data.showPlayerMenu || this.data.playerMenu !== menu;
    this.clearPlayerControlsTimer();
    this.setData({ playerMenu: menu, showPlayerMenu, showVideoControls: true });
    if (!showPlayerMenu) this.schedulePlayerControlsHide();
  },
  toggleMirror() { this.setData({ isMirrored: !this.data.isMirrored }); this.schedulePlayerControlsHide(); },
  toggleMute() { this.setData({ isMuted: !this.data.isMuted }); this.schedulePlayerControlsHide(); },
  togglePlayback() {
    if (!this.videoContext || !this.data.playUrl) return;
    if (this.data.isPlaying) this.videoContext.pause(); else this.resumePlayback();
    this.schedulePlayerControlsHide();
  },
  seekPlayback(event) {
    this.cancelAutoplay();
    this.setData({ lessonEnded: false });
    if (!this.videoContext || !this.data.currentDuration) return;
    const seconds = Math.max(0, Math.min(this.data.currentDuration, Number(event.detail.value) || 0));
    this.videoContext.seek(seconds);
    this.setData({ currentSeconds: seconds, currentTimeText: this.formatTimestamp(seconds) });
    this.schedulePlayerControlsHide();
  },
  adjacentVideo(event) {
    const offset = Number(event.currentTarget.dataset.offset);
    if (offset !== -1 && offset !== 1) return;
    const index = this.data.outline.findIndex(row => String(row.videoId) === String(this.data.videoId));
    const target = index >= 0 && this.data.outline[index + offset];
    if (target) { this.scrollToPlayer(); this.saveCurrentProgress(); this.loadVideo(target.videoId); }
  },
  closePlayerMenu() {
    this.setData({ showPlayerMenu: false });
    this.schedulePlayerControlsHide();
  },
  requestSmallWindow() {
    this.saveCurrentProgress();
    const context = this.videoContext;
    if (!context || typeof context.requestBackgroundPlayback !== "function") return wx.showToast({ title: "当前微信暂不支持小窗播放", icon: "none" });
    try { context.requestBackgroundPlayback(); } catch (_) {}
  },
  requestPlayerFullScreen() {
    this.setData({ showPlayerMenu: false, showVideoControls: true });
    this.setData({ isPlayerFullscreen: !this.data.isPlayerFullscreen });
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
    if (!this.data.rateOptions.includes(rate) || !this.videoContext) return;
    this.videoContext.playbackRate(rate);
    this.setData({ playbackRate: rate, showPlayerMenu: false });
    this.schedulePlayerControlsHide();
  },
  onVideoPlay() {
    this.cancelAutoplay();
    this.clearPlayerControlsTimer();
    this.setData({ isPlaying: true, lessonEnded: false, showVideoControls: false, showPlayerMenu: false });
    if (this.videoContext && this.videoContext.playbackRate) this.videoContext.playbackRate(this.data.playbackRate);
    this.schedulePlayerControlsHide();
  }
})));
