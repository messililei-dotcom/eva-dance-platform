const eventView=require('../../shared/event-view');
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
    players: [], visiblePlayers: [], podium: [], playerQuery: '', playerPage: 1, playerPageCount: 1,
    hasPublishedResults: false
  },
  onLoad(options) {
    this.setData({ competitionId: options.id || "", groupId: options.groupId || "" });
    this.loadGroup();
  },
  onPullDownRefresh() {
    this.loadGroup().finally(() => wx.stopPullDownRefresh());
  },
  onPlayerSearch(event) {this.setData({playerQuery:String(event.detail.value||'')});this.applyPlayerPage(1);},
  applyPlayerPage(number) {const q=this.data.playerQuery.trim().toLowerCase();const rows=this.data.players.filter(p=>!q||`${p.name} ${p.playerNo||''} ${p.organization||''}`.toLowerCase().includes(q));const page=eventView.page(rows,number);this.setData({visiblePlayers:page.rows,playerPage:page.number,playerPageCount:page.pages});},
  changePlayerPage(event) {this.applyPlayerPage(this.data.playerPage+Number(event.currentTarget.dataset.offset));},
  openPlayer(event) {wx.navigateTo({url:`/pages/event-player/event-player?id=${this.data.competitionId}&groupId=${this.data.groupId}&playerId=${event.currentTarget.dataset.id}`});},
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
      this.setData({podium:players.filter(p=>p.rankNo>0&&p.rankNo<=3).sort((a,b)=>a.rankNo-b.rankNo)});
      this.applyPlayerPage(1);
      wx.setNavigationBarTitle({ title: group.name || "赛事组别" });
    } catch (err) {
      this.setData({ loading: false });
      wx.showToast({ title: err.message || "组别选手加载失败", icon: "none" });
    }
  }
}));
