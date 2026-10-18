const share = require("../../shared/share");
const api = require("../../utils/api");
const { eventState } = require("../../shared/event-state");

function dateText(value) {
  return String(value || "").slice(0, 10) || "时间待定";
}

function normalizeEvent(item) {
  return {
    ...item,
    coverUrl: item.coverUrl || item.cover_url || "",
    dateText: item.endDate && item.endDate !== item.startDate
      ? `${dateText(item.startDate)} 至 ${dateText(item.endDate)}`
      : dateText(item.startDate),
    feeText: Number(item.registrationFee || 0) > 0 ? `¥${Number(item.registrationFee).toFixed(2)}` : "免费报名",
    ...eventState(item)
  };
}

Page(share.withShare("events", {
  data: {
    loading: true,
    error: "",
    events: [],
    visibleEvents: [],
    keyword: "",
    eventCount: 0,
    playerCount: 0,
    recordCount: 0
  },
  onLoad() {
    this.loadEvents();
  },
  onPullDownRefresh() {
    this.loadEvents().finally(() => wx.stopPullDownRefresh());
  },
  async loadEvents() {
    this.setData({ loading: true, error: "" });
    try {
      const events = (await api.getEvents() || []).map(normalizeEvent);
      this.setData({
        events,
        loading: false,
        eventCount: events.length,
        playerCount: events.reduce((sum, item) => sum + Number(item.approvedPlayerCount || item.playerCount || 0), 0),
        recordCount: events.reduce((sum, item) => sum + Number(item.rankingCount || item.scoreCount || 0), 0)
      });
      this.applySearch(this.data.keyword, events);
    } catch (err) {
      this.setData({ loading: false, error: err.message || "赛事加载失败，请重试" });
    }
  },
  onSearchInput(event) {
    const keyword = String(event.detail.value || "");
    this.setData({ keyword });
    this.applySearch(keyword, this.data.events);
  },
  applySearch(keyword, source) {
    const query = String(keyword || "").trim().toLowerCase();
    const visibleEvents = query
      ? (source || []).filter(item => `${item.name || ""} ${item.location || ""}`.toLowerCase().includes(query))
      : (source || []);
    this.setData({ visibleEvents });
  },
  goRegister(event) {
    const id = event.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/event-register/event-register?id=${id}` });
  },
  openEvent(event) {
    wx.navigateTo({ url: `/pages/event-detail/event-detail?id=${event.currentTarget.dataset.id}` });
  },
  onImageError(event) {
    this.setData({ [`visibleEvents[${Number(event.currentTarget.dataset.index)}].coverUrl`]: "" });
  }
}));
