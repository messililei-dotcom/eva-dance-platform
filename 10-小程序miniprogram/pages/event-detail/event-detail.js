const share = require("../../shared/share");
const api = require("../../utils/api");

function shortDate(value) {
  return String(value || "").replace("T", " ").slice(0, 16) || "待定";
}

function normalizeRanking(item) {
  const rankNo = Number(item.rankNo || 0);
  const score = item.publishedTotal;
  return {
    ...item,
    rankNo,
    rankClass: rankNo === 1 ? "gold" : rankNo === 2 ? "silver" : rankNo === 3 ? "bronze" : "normal",
    rankLabel: rankNo === 1 ? "冠军" : rankNo === 2 ? "亚军" : rankNo === 3 ? "季军" : rankNo ? `第${rankNo}名` : "排名",
    scoreText: score === null || score === undefined || score === ""
      ? "-"
      : Number(score).toFixed(3).replace(/\.?0+$/, "")
  };
}

Page(share.withShare("event-detail", {
  data: {
    id: null, loading: true, competition: {}, groups: [], visibleGroups: [], groupKeyword: "", players: [], judges: [],
    rankings: [], sessions: [], awards: [], registrations: [], activePanel: "overview",
    panels: [
      { key: "overview", label: "赛事" }, { key: "groups", label: "组别" },
      { key: "players", label: "选手" }, { key: "judges", label: "评委" },
      { key: "results", label: "成绩" }
    ]
  },
  onLoad(options) {
    this.setData({ id: options.id });
    this.loadDetail();
  },
  onShow() {
    if (this.data.id) this.loadRegistrations();
  },
  onPullDownRefresh() {
    Promise.all([this.loadDetail(), this.loadRegistrations()]).finally(() => wx.stopPullDownRefresh());
  },
  async loadDetail() {
    this.setData({ loading: true });
    try {
      const data = await api.getEventDetail(this.data.id);
      const competition = data.competition || {};
      const registrationOpen = competition.registrationStatus === "open"
        && (!competition.registrationStart || Date.parse(competition.registrationStart) <= Date.now())
        && (!competition.registrationEnd || Date.parse(competition.registrationEnd) >= Date.now());
      this.setData({
        competition: {
          ...competition,
          coverUrl: competition.coverUrl || competition.cover_url || "",
          dateText: competition.endDate && competition.endDate !== competition.startDate
            ? `${shortDate(competition.startDate).slice(0, 10)} 至 ${shortDate(competition.endDate).slice(0, 10)}`
            : shortDate(competition.startDate).slice(0, 10),
          registrationText: registrationOpen ? "报名中" : "报名已关闭",
          registrationOpen,
          feeText: Number(competition.registrationFee || 0) > 0 ? `¥${Number(competition.registrationFee).toFixed(2)}` : "免费"
        },
        groups: data.groups || [], visibleGroups: data.groups || [], players: data.players || [], judges: data.judges || [],
        rankings: (data.rankings || []).map(normalizeRanking), awards: data.awards || [],
        sessions: (data.sessions || []).map(item => ({ ...item, timeText: shortDate(item.startsAt) })),
        loading: false
      });
      wx.setNavigationBarTitle({ title: competition.name || "赛事详情" });
    } catch (err) {
      this.setData({ loading: false });
      wx.showToast({ title: err.message || "赛事详情加载失败", icon: "none" });
    }
  },
  async loadRegistrations() {
    const rows = await api.getMyEventRegistrations(this.data.id).catch(() => []);
    const auditLabels = { pending: "待审核", approved: "已通过", rejected: "未通过" };
    const paidLabels = { unpaid: "待缴费", paid: "已缴费", refunded: "已退款" };
    this.setData({ registrations: (rows || []).map(item => ({
      ...item,
      auditStatusText: auditLabels[item.auditStatus] || item.auditStatus,
      paidStatusText: paidLabels[item.paidStatus] || item.paidStatus,
      resultText: item.resultPublished
        ? `${item.awardName || (item.rankNo ? `第${item.rankNo}名` : "成绩已公示")} · ${item.totalScore == null ? "-" : item.totalScore}分`
        : "成绩待公示"
    })) });
  },
  switchPanel(event) { this.setData({ activePanel: event.currentTarget.dataset.key }); },
  onGroupSearch(event) {
    const groupKeyword = String(event.detail.value || "");
    const query = groupKeyword.trim().toLowerCase();
    const visibleGroups = query
      ? this.data.groups.filter(item => `${item.name || ""} ${item.category || ""} ${item.danceType || ""} ${item.ageRange || ""}`.toLowerCase().includes(query))
      : this.data.groups;
    this.setData({ groupKeyword, visibleGroups });
  },
  openGroup(event) {
    const groupId = event.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/event-group/event-group?id=${this.data.id}&groupId=${groupId}` });
  },
  goRegister() {
    if (!this.data.competition.registrationOpen) {
      wx.showToast({ title: "赛事报名尚未开放或已经结束", icon: "none" });
      return;
    }
    wx.navigateTo({ url: `/pages/event-register/event-register?id=${this.data.id}` });
  },
}));
