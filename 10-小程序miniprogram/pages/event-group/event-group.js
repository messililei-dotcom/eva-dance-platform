const share = require("../../shared/share");
const api = require("../../utils/api");

function formatScore(value) {
  if (value === null || value === undefined || value === "") return "-";
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  return number.toFixed(3).replace(/\.?0+$/, "");
}

function normalizePlayer(item, index) {
  const rankNo = Number(item.rankNo || 0);
  return {
    ...item,
    displayNo: item.playerNo || index + 1,
    displayInitial: String(item.name || "选").slice(0, 1),
    rankNo,
    rankClass: rankNo === 1 ? "gold" : rankNo === 2 ? "silver" : rankNo === 3 ? "bronze" : "normal",
    rankLabel: rankNo === 1 ? "冠军" : rankNo === 2 ? "亚军" : rankNo === 3 ? "季军" : rankNo ? `第${rankNo}名` : "排名",
    scoreText: formatScore(item.publishedTotal),
    identityText: [
      item.playerNo ? `编号 ${item.playerNo}` : "",
      item.organization || "",
      item.teacher ? `指导老师 ${item.teacher}` : ""
    ].filter(Boolean).join(" · ") || "报名信息已确认"
  };
}

Page(share.withShare("event-group", {
  data: {
    competitionId: "",
    groupId: "",
    loading: true,
    competition: {},
    group: {},
    players: [],
    hasPublishedResults: false
  },
  onLoad(options) {
    this.setData({ competitionId: options.id || "", groupId: options.groupId || "" });
    this.loadGroup();
  },
  onPullDownRefresh() {
    this.loadGroup().finally(() => wx.stopPullDownRefresh());
  },
  async loadGroup() {
    this.setData({ loading: true });
    try {
      const data = await api.getEventGroupDetail(this.data.competitionId, this.data.groupId);
      const group = data.group || {};
      const players = (data.players || []).map(normalizePlayer);
      const hasPublishedResults = Number(group.rankingCount || 0) > 0 || players.some(item => item.resultPublished);
      this.setData({
        competition: data.competition || {},
        group,
        players,
        hasPublishedResults,
        loading: false
      });
      wx.setNavigationBarTitle({ title: group.name || "赛事组别" });
    } catch (err) {
      this.setData({ loading: false });
      wx.showToast({ title: err.message || "组别选手加载失败", icon: "none" });
    }
  }
}));
