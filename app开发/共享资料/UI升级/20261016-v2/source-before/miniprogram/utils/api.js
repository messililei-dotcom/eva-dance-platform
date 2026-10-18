const runtimeConfig = require("../shared/runtime-config");

const { sortEventsNewestFirst } = require("../shared/event-sort");

const DEFAULT_TIMEOUT = 8000;

function getMiniApp() {
  try {
    return getApp();
  } catch (err) {
    return null;
  }
}

function getApiBases(kind) {
  const app = getMiniApp();
  const globalData = app && app.globalData ? app.globalData : {};
  if (kind === "login") {
    return [
      globalData.loginApiBase || runtimeConfig.loginApiBase || globalData.apiBase || runtimeConfig.apiBase,
      ...(globalData.fallbackLoginApiBases || runtimeConfig.fallbackLoginApiBases || [])
    ].filter(Boolean);
  }

  return [
    globalData.apiBase || runtimeConfig.apiBase,
    ...(globalData.fallbackApiBases || runtimeConfig.fallbackApiBases || [])
  ].filter(Boolean);
}

function getErrorMessage(body, fallback) {
  if (!body || typeof body !== "object") return fallback;
  return body.message || body.error || body.msg || fallback;
}

function createRequestError(message, statusCode, code) {
  const error = new Error(message || "请求失败");
  error.statusCode = Number(statusCode || 0);
  error.code = code || (error.statusCode ? `HTTP_${error.statusCode}` : "NETWORK_ERROR");
  return error;
}

function shouldEnsureLogin(path, options) {
  if (options.auth === false) return false;
  if (wx.getStorageSync("token")) return false;
  return !path.startsWith("/public/");
}

function request(path, options = {}) {
  const app = getMiniApp();
  const needsLogin = shouldEnsureLogin(path, options);
  const run = () => rawRequest(path, options).catch(async err => {
    if (options.auth === false || options._sessionRetried || Number(err.statusCode) !== 401
      || !app || typeof app.ensureSilentLogin !== "function") throw err;
    wx.removeStorageSync("token");
    const refreshed = await app.ensureSilentLogin(true).catch(() => null);
    if (!refreshed || !wx.getStorageSync("token")) throw err;
    return rawRequest(path, { ...options, _sessionRetried: true });
  });
  if (needsLogin && app && typeof app.ensureSilentLogin === "function") {
    return app.ensureSilentLogin().catch(() => null).then(run);
  }
  return run();
}

function rawRequest(path, options = {}) {
  const bases = getApiBases();
  return new Promise((resolve, reject) => {
    if (!bases.length) {
      reject(new Error("接口地址未配置"));
      return;
    }

    const tryRequest = (index) => {
      const base = bases[index];
      const token = wx.getStorageSync("token");
      const referral = wx.getStorageSync("referralContext") || {};
      const pages = typeof getCurrentPages === "function" ? getCurrentPages() : [];
      const currentPage = pages.length ? pages[pages.length - 1] : null;
      const pageUrl = currentPage && currentPage.route ? `/${currentPage.route}` : "";
      wx.request({
        url: `${base}${path}`,
        method: options.method || "GET",
        data: options.data || {},
        timeout: options.timeout || DEFAULT_TIMEOUT,
        header: {
          "content-type": "application/json",
          "x-client-platform": "miniprogram",
          ...(pageUrl ? { "x-page-url": pageUrl } : {}),
          ...(referral.memberId ? { "x-referrer-member-id": String(referral.memberId) } : {}),
          ...(referral.channel ? { "x-referrer-channel": String(referral.channel) } : {}),
          ...(referral.shareCode ? { "x-share-code": String(referral.shareCode) } : {}),
          ...(options.header || {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        success(res) {
          const body = res.data || {};
          if (res.statusCode >= 200 && res.statusCode < 300 && body.success !== false) {
            resolve(normalizeAssets(body.data !== undefined ? body.data : body, base));
            return;
          }
          if (index + 1 < bases.length) {
            tryRequest(index + 1);
            return;
          }
          reject(createRequestError(
            res.statusCode >= 500
              ? "服务器暂时繁忙，请稍后重试"
              : getErrorMessage(body, res.statusCode === 401 ? "登录状态已失效" : "请求失败"),
            res.statusCode
          ));
        },
        fail(err) {
          if (index + 1 < bases.length) {
            tryRequest(index + 1);
            return;
          }
          const timeout = /timeout/i.test(err.errMsg || "");
          reject(createRequestError(timeout ? "网络连接超时，请重新连接" : "网络连接失败，请检查网络后重试", 0, timeout ? "NETWORK_TIMEOUT" : "NETWORK_ERROR"));
        }
      });
    };
    tryRequest(0);
  });
}

function loginRequest(path, data = {}) {
  const bases = getApiBases("login");
  return new Promise((resolve, reject) => {
    if (!bases.length) {
      reject(new Error("登录接口地址未配置"));
      return;
    }

    const tryRequest = (index) => {
      const base = bases[index];
      const token = wx.getStorageSync("token");
      wx.request({
        url: `${base}${path}`,
        method: "POST",
        data,
        timeout: DEFAULT_TIMEOUT,
        header: {
          "content-type": "application/json",
          "x-client-platform": "miniprogram",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        success(res) {
          const body = res.data || {};
          if (res.statusCode >= 200 && res.statusCode < 300 && body.success !== false) {
            resolve(body);
            return;
          }
          if (index + 1 < bases.length) {
            tryRequest(index + 1);
            return;
          }
          reject(createRequestError(
            res.statusCode >= 500 ? "服务器暂时繁忙，请稍后重试" : getErrorMessage(body, "请求失败"),
            res.statusCode
          ));
        },
        fail(err) {
          if (index + 1 < bases.length) {
            tryRequest(index + 1);
            return;
          }
          const timeout = /timeout/i.test(err.errMsg || "");
          reject(createRequestError(timeout ? "网络连接超时，请稍后重试" : "网络连接失败，请检查网络后重试", 0, timeout ? "NETWORK_TIMEOUT" : "NETWORK_ERROR"));
        }
      });
    };
    tryRequest(0);
  });
}

function websiteRequest(path, data = {}) {
  const base = String(runtimeConfig.pwaAuthBase || runtimeConfig.officialWebsiteUrl || "").replace(/\/$/, "");
  return new Promise((resolve, reject) => {
    if (!base) {
      reject(createRequestError("PWA登录地址未配置", 0, "CONFIG_ERROR"));
      return;
    }
    const token = wx.getStorageSync("token");
    if (!token) {
      reject(createRequestError("小程序登录状态已失效", 401));
      return;
    }
    wx.request({
      url: `${base}${path}`,
      method: "POST",
      data,
      timeout: DEFAULT_TIMEOUT,
      header: {
        "content-type": "application/json",
        "x-client-platform": "miniprogram-pwa-handoff",
        Authorization: `Bearer ${token}`
      },
      success(res) {
        const body = res.data || {};
        if (res.statusCode >= 200 && res.statusCode < 300 && body.success !== false) {
          resolve(body);
          return;
        }
        reject(createRequestError(getErrorMessage(body, "PWA登录确认失败"), res.statusCode));
      },
      fail(err) {
        const timeout = /timeout/i.test(err.errMsg || "");
        reject(createRequestError(timeout ? "网络连接超时" : "网络连接失败", 0));
      }
    });
  });
}

function normalizeAssets(value, apiBase) {
  const origin = apiBase.replace(/\/api(?:\/.*)?$/, "").replace(/\/$/, "");
  const apiAssetPattern = /^https?:\/\/[^/]+\/api\//;
  const isImageKey = (key) => key.indexOf("image") >= 0
    || key === "thumbnail"
    || key.indexOf("cover") >= 0
    || key.indexOf("avatar") >= 0
    || key.indexOf("poster") >= 0;
  const isAssetKey = (key) => isImageKey(key) || /(?:url|path)$/i.test(key);
  const withOrigin = (path) => `${origin}${path}`;
  const normalizeImagePath = (source) => {
    if (source.startsWith("/uploads/online-course/series-covers/")) {
      const filename = encodeURIComponent(decodeURIComponent(source.split("/").pop() || ""));
      return `/api/course/series/cover/${filename}`;
    }
    if (source.startsWith("/uploads/")) return `/api/course/cover-image?src=${encodeURIComponent(source)}`;
    return source;
  };
  const normalizeAsset = (url, key) => {
    if (!url || typeof url !== "string") return url;
    let trimmed = url.trim();
    if (!trimmed) return "";
    if (isImageKey(key) && /^https?:\/\/admin\.dongfangwuquan\.com\//i.test(trimmed)) {
      const path = trimmed.replace(/^https?:\/\/admin\.dongfangwuquan\.com/i, "");
      const normalizedPath = normalizeImagePath(path);
      if (normalizedPath.startsWith("/api/course/")) return withOrigin(normalizedPath);
    }
    if (isImageKey(key) && /^\/api\/shop\/images\//.test(trimmed)) return runtimeConfig.officialWebsiteUrl + trimmed;
    if (isImageKey(key) && /^https:\/\/www\.swod\.com\.cn\/api\/shop\/images\//.test(trimmed)) return trimmed;
    if (trimmed.startsWith("/api/course/") && isImageKey(key)) return withOrigin(trimmed);
    if (isImageKey(key)) {
      const path = trimmed.replace(/^https?:\/\/[^/]+/, "");
      const trustedImageApi = /^\/api\/(?:courses?\/cover-image(?:[?]|$)|platform-offline-courses\/cover\/|course\/series\/cover\/)/.test(path);
      if (trustedImageApi) return /^https?:\/\//.test(trimmed) ? trimmed : withOrigin(trimmed);
    }
    if ((trimmed.startsWith("/api/") || apiAssetPattern.test(trimmed)) && isImageKey(key)) return "";
    if (/^https?:\/\//.test(trimmed)) return trimmed;
    if (trimmed.startsWith("//")) return `https:${trimmed}`;
    if (isImageKey(key)) {
      const normalizedPath = normalizeImagePath(trimmed);
      if (normalizedPath.startsWith("/api/course/")) return withOrigin(normalizedPath);
    }
    if (trimmed.startsWith("/official-images/") || trimmed.startsWith("/api/") || trimmed.startsWith("/static/")) return `${origin}${trimmed}`;
    return trimmed;
  };

  if (Array.isArray(value)) return value.map(item => normalizeAssets(item, apiBase));
  if (value && typeof value === "object") {
    const next = {};
    Object.keys(value).forEach(key => {
      next[key] = isAssetKey(key)
        ? normalizeAsset(value[key], key)
        : normalizeAssets(value[key], apiBase);
    });
    return next;
  }
  return value;
}

function getMemberId() {
  const app = getMiniApp();
  return (app && app.globalData && app.globalData.memberId) || wx.getStorageSync("memberId") || 0;
}

function upload(path, filePath, name, formData = {}) {
  const bases = getApiBases();
  return new Promise((resolve, reject) => {
    if (!bases.length) {
      reject(new Error("上传接口地址未配置"));
      return;
    }

    const tryUpload = (index) => {
      const base = bases[index];
      const token = wx.getStorageSync("token");
      wx.uploadFile({
        url: `${base}${path}`,
        filePath,
        name,
        timeout: DEFAULT_TIMEOUT,
        header: token ? { Authorization: `Bearer ${token}` } : {},
        formData,
        success(res) {
          let body = {};
          try {
            body = JSON.parse(res.data || "{}");
          } catch (err) {
            body = {};
          }
          if (res.statusCode >= 200 && res.statusCode < 300 && body.success !== false) {
            resolve(normalizeAssets(body.data !== undefined ? body.data : body, base));
            return;
          }
          if (index + 1 < bases.length) {
            tryUpload(index + 1);
            return;
          }
          reject(new Error(getErrorMessage(body, "上传失败")));
        },
        fail(err) {
          if (index + 1 < bases.length) {
            tryUpload(index + 1);
            return;
          }
          reject(new Error(err.errMsg || "网络连接失败"));
        }
      });
    };
    tryUpload(0);
  });
}

module.exports = {
  getFeatures() { return request("/public/features", { auth: false }); },
  request,
  // 发送验证码
  sendCode(phone) {
    return loginRequest("/send-code", { phone });
  },
  // 手机号登录
  studentLogin(phone, code) {
    return loginRequest("/student-login", { phone, code });
  },
  phoneLogin(code) {
    return loginRequest("/phone-login", { code });
  },
  silentLogin(code) {
    return loginRequest("/silent-login", { code });
  },
  completePwaLoginHandoff(handoffId) {
    return websiteRequest("/api/wechat/mini-handoff/complete", { handoffId });
  },
  getSeriesList() {
    return request("/public/series", { auth: false }).then(rows => (rows || []).filter(item => item.status === "published"));
  },
  getOfflineCourses() {
    return request("/public/offline-courses", { auth: false, timeout: 20000 });
  },
  getOfflineOverview(courseIds = []) {
    const ids = courseIds.map(Number).filter(id => Number.isSafeInteger(id) && id > 0);
    return request(`/offline/overview?member_id=${getMemberId()}${ids.length ? "&course_ids=" + ids.join(",") : ""}`);
  },
  getHomeStats() {
    return request("/public/home-stats", { auth: false });
  },
  getEvents() {
    return request("/events", { auth: false }).then(sortEventsNewestFirst);
  },
  getEventDetail(id) {
    return request(`/events/${id}`, { auth: false });
  },
  getEventPlayerDetail(id, groupId, playerId) { return request(`/events/${id}/groups/${groupId}/players/${playerId}`, { auth: false }); },
  getEventGroupDetail(id, groupId) {
    return request(`/events/${id}/groups/${groupId}`, { auth: false });
  },
  getMyEventRegistrations(id) {
    return request('/member/events').then(result => (result.entries || []).filter(row => String(row.competitionId) === String(id)).map(row => ({ ...row, id: row.playerId })));
  },
  registerEvent(id, data) {
    return request(`/events/${id}/register`, {
      method: "POST",
      data: { member_id: getMemberId(), ...data }
    });
  },
  registerEventWithMusic(id, filePath, data) {
    return upload(`/events/${id}/register`, filePath, "musicFile", {
      member_id: String(getMemberId()),
      musicSource: "wechat",
      ...data
    });
  },
  getSeriesDetail(id) {
    return request(`/public/series/${id}`, { auth: false });
  },
  getSeriesMeta(id) {
    return request(`/public/series/${id}/detail`, { auth: false });
  },
  getSeriesCourses(id) {
    return request(`/public/series/${id}/courses`, { auth: false });
  },
  getSeriesProgress(id) {
    return request(`/public/series/${id}/progress`);
  },
  checkAuthorization(seriesId) {
    return request(`/authorization/check?member_id=${getMemberId()}&series_id=${seriesId}`);
  },
  getAuthorizedSeries() {
    return request(`/member/authorized-series?member_id=${getMemberId()}`);
  },
  getMessages({ type = '', status = '', cursor = 0 } = {}) {
    return request(`/member/messages?member_id=${getMemberId()}&limit=20&type=${encodeURIComponent(type)}&status=${encodeURIComponent(status)}&cursor=${Number(cursor) || 0}`);
  },
  getUnreadMessageCount() { return request(`/member/messages/unread-count?member_id=${getMemberId()}`); },
  markMessageRead(id) { return request(`/member/messages/${encodeURIComponent(id)}/read?member_id=${getMemberId()}`, { method: 'PATCH' }); },
  markAllMessagesRead() { return request(`/member/messages/read-all?member_id=${getMemberId()}`, { method: 'POST' }); },
  getMemberProfile() {
    return request(`/member/profile?member_id=${getMemberId()}`);
  },
  updateMemberProfile(data) {
    return request('/member/profile', {
      method: 'PUT',
      data: {
        member_id: getMemberId(),
        ...data
      }
    });
  },
  getCertificates() {
    return request(`/certificates?member_id=${getMemberId()}`);
  },
  syncWechatProfile(data) {
    return request("/member/wechat-profile", {
      method: "POST",
      data: {
        member_id: getMemberId(),
        nickname: data.nickname || "",
        avatar_url: data.avatarUrl || data.avatar_url || ""
      }
    });
  },
  uploadWechatAvatar(filePath) {
    return upload("/member/wechat-avatar", filePath, "avatar", {
      member_id: getMemberId()
    });
  },
  getAdminStatus() {
    return request(`/admin/status?member_id=${getMemberId()}`);
  },
  getMiniAdminConfig() {
    return request("/admin/miniprogram-config");
  },
  createSeries(data) {
    return request("/series", { method: "POST", data });
  },
  updateSeries(id, data) {
    return request(`/series/${id}`, { method: "PUT", data });
  },
  authorizePhone(seriesId, phone) {
    return request(`/series/${seriesId}/authorize-phone`, {
      method: "POST",
      data: { phone }
    });
  },
  getRecentCourses() {
    return request(`/member/recent-courses?member_id=${getMemberId()}`);
  },
  getPayments() {
    return request(`/member/payments?member_id=${getMemberId()}`);
  },
  getConsumeRecords() {
    return request(`/member/consume-records?member_id=${getMemberId()}`);
  },
  getEventRegistrations() {
    return request(`/member/events?member_id=${getMemberId()}`).then(data => {
      const rows = Array.isArray(data) ? data : data && data.entries || [];
      return sortEventsNewestFirst(rows.map(item => ({ ...item, id: item.id || item.playerId })));
    });
  },
  getCheckins() {
    return request(`/member/checkins?member_id=${getMemberId()}`);
  },
  createCheckin() {
    return request("/member/checkins", {
      method: "POST",
      data: {
        member_id: getMemberId()
      }
    });
  },
  getVideoPlay(videoId) {
    return request(`/video/${videoId}/play?member_id=${getMemberId()}`);
  },
  getVideoProgress(videoId) {
    return request(`/video/${videoId}/progress?member_id=${getMemberId()}`);
  },
  saveVideoProgress(videoId, progress, duration) {
    return request(`/video/${videoId}/progress`, {
      method: "POST",
      data: {
        member_id: getMemberId(),
        progress,
        duration
      }
    });
  },
  // 笔记 API
  createNote(videoId, timestamp, content) {
    return request("/notes", {
      method: "POST",
      data: {
        member_id: getMemberId(),
        video_id: videoId,
        timestamp_seconds: timestamp,
        content
      }
    });
  },
  getNotes(videoId) {
    return request(`/notes?member_id=${getMemberId()}&video_id=${videoId}`);
  },
  getAllNotes() {
    return request(`/notes/all?member_id=${getMemberId()}`);
  },
  deleteNote(noteId) {
    return request(`/notes/${noteId}?member_id=${getMemberId()}`, {
      method: "DELETE"
    });
  },
  // 收藏 API
  createBookmark(videoId, timestamp, label) {
    return request("/bookmarks", {
      method: "POST",
      data: {
        member_id: getMemberId(),
        video_id: videoId,
        timestamp_seconds: timestamp,
        label
      }
    });
  },
  getBookmarks(videoId) {
    return request(`/bookmarks?member_id=${getMemberId()}&video_id=${videoId}`);
  },
  getAllBookmarks() {
    return request(`/bookmarks/all?member_id=${getMemberId()}`);
  },
  deleteBookmark(bookmarkId) {
    return request(`/bookmarks/${bookmarkId}?member_id=${getMemberId()}`, {
      method: "DELETE"
    });
  },
  // 打卡 API
  submitCheckin(seriesId, submissionType, submissionUrl, remark) {
    return request("/checkins", {
      method: "POST",
      data: {
        member_id: getMemberId(),
        series_id: seriesId,
        submission_type: submissionType,
        submission_url: submissionUrl,
        remark
      }
    });
  },
  getMyCheckins() {
    return request(`/checkins/my?member_id=${getMemberId()}`);
  },
  getSeriesCheckins(seriesId) {
    return request(`/checkins/series/${seriesId}`);
  },
  // 动态 API
  getSeriesActivity(seriesId) {
    return request(`/activity/series/${seriesId}`);
  }
};
