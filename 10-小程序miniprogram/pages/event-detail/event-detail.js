const eventView=require('../../shared/event-view');
const { eventAgeGroup } = require('../../shared/event-age');
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
    id: null, loading: true, competition: {}, groups: [], visibleGroups: [], groupPage:1, groupPageCount:1, groupTotal:0, groupKeyword: "", groupAgeFilter: "全部", groupAgeFilters: ["全部", "成人", "青少年", "少儿"], registrationsLoading: false, registrationError: "", players: [], judges: [],
    rankings: [], sessions: [], awards: [], registrations: [], activePanel: "groups",
    panels: [
      { key: "overview", label: "概览" }, { key: "groups", label: "组别" },
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
      const { registrationOpen, statusText } = require('../../shared/event-state').eventState(competition);
      const groups=(data.groups||[]).map((g,i)=>({...g,ordinal:i+1,ageCategory:eventAgeGroup(g.name,g.ageRange,g.category),playerCountText:g.playerCount==null?'报名信息未公开':g.playerCount+'位选手',groupStatusText:Number(g.rankingCount)>0?'已公示'+g.rankingCount+'项得分':registrationOpen?'报名中':'成绩待公布'}));
      this.setData({
        competition: {
          ...competition,
          coverUrl: competition.coverUrl || competition.cover_url || "",
          dateText: competition.endDate && competition.endDate !== competition.startDate
            ? `${shortDate(competition.startDate).slice(0, 10)} 至 ${shortDate(competition.endDate).slice(0, 10)}`
            : shortDate(competition.startDate).slice(0, 10),
          registrationText: statusText,
          registrationOpen,
          feeText: Number(competition.registrationFee || 0) > 0 ? `¥${Number(competition.registrationFee).toFixed(2)}` : "免费"
        },
        groups, players: (data.players || []).map(eventView.player), judges: (competition.judgeScoresPublic ? data.judges || [] : []).map(j=>({...j,initial:String(j.name||'评').slice(0,1)})),
        rankings: (data.rankings || []).map(normalizeRanking), awards: data.awards || [],
        sessions: (data.sessions || []).map(item => ({ ...item, timeText: shortDate(item.startsAt) })),
        loading: false
      });
      this.applyGroupPage(1);
      wx.setNavigationBarTitle({ title: "赛事详情" });
    } catch (err) {
      this.setData({ loading: false });
      wx.showToast({ title: err.message || "赛事详情加载失败", icon: "none" });
    }
  },
  async loadRegistrations() {
    const version = (this.registrationLoadVersion || 0) + 1;
    this.registrationLoadVersion = version;
    const account = wx.getStorageSync ? String(wx.getStorageSync('token') || '') : '';
    this.setData({ registrationsLoading: true, registrationError: '' });
    try {
    const rows = await api.getMyEventRegistrations(this.data.id);
    if (version !== this.registrationLoadVersion) return;
    if (wx.getStorageSync && String(wx.getStorageSync('token') || '') !== account) { this.setData({ registrations: [], registrationsLoading: false, registrationError: '登录状态已更新，请重新加载报名信息' }); return; }
    const auditLabels = { pending: '已报名', approved: '已报名', rejected: '未通过' };
    const paidLabels = { unpaid: "待缴费", paid: "已缴费", refunded: "已退款" };
    this.setData({ registrations: (rows || []).map(item => ({
      ...item,
      auditStatusText: auditLabels[item.auditStatus] || item.auditStatus,
      paidStatusText: paidLabels[item.paidStatus] || item.paidStatus,
      resultText: item.resultPublished
        ? `${item.awardName || (item.rankNo ? `第${item.rankNo}名` : "成绩已公示")} · ${item.totalScore == null ? "-" : item.totalScore}分`
        : "成绩待公示"
    })), registrationsLoading: false });
    } catch (error) { if (version === this.registrationLoadVersion) this.setData({ registrations: [], registrationsLoading: false, registrationError: error.message || '报名信息加载失败，请重试' }); }
  },
  goMyRegistrations() { this.setData({ activePanel: 'registrations' }); this.loadRegistrations(); },

  payRegistration(event) { wx.navigateTo({url:'/pages/course-checkout/course-checkout?kind=event&id='+encodeURIComponent(event.currentTarget.dataset.id)}); },
  switchPanel(event) { this.setData({ activePanel: event.currentTarget.dataset.key }); },
  onGroupAgeFilter(event) { this.setData({ groupAgeFilter: event.currentTarget.dataset.age }); this.applyGroupPage(1); },
  onGroupSearch(event) { this.setData({ groupKeyword:String(event.detail.value||'') });this.applyGroupPage(1); },
  applyGroupPage(number) {
    const query=this.data.groupKeyword.trim().toLowerCase();
    const rows=this.data.groups.filter(g=>(this.data.groupAgeFilter==='全部'||g.ageCategory===this.data.groupAgeFilter)&&(!query||`${g.name} ${g.category||''} ${g.danceType||''} ${g.ageRange||''}`.toLowerCase().includes(query)));
    const p=eventView.page(rows,number);
    this.setData({visibleGroups:p.rows,groupPage:p.number,groupPageCount:p.pages,groupTotal:p.total});
  },
  changeGroupPage(event) { this.applyGroupPage(this.data.groupPage+Number(event.currentTarget.dataset.offset)); },
  openJudge(event){wx.navigateTo({url:`/pages/event-judge-profile/event-judge-profile?id=${encodeURIComponent(this.data.id)}&judgeId=${encodeURIComponent(event.currentTarget.dataset.id)}`});},
  openPlayer(event) { const {group,id}=event.currentTarget.dataset;wx.navigateTo({url:`/pages/event-player/event-player?id=${this.data.id}&groupId=${group}&playerId=${id}`}); },
  openGroup(event) {
    const groupId = event.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/event-group/event-group?id=${this.data.id}&groupId=${groupId}` });
  },
  goJudge() { wx.navigateTo({ url: `/pages/event-judge/event-judge?id=${this.data.id}` }); },
  goRegister() {
    if (!this.data.competition.registrationOpen) {
      wx.showToast({ title: "赛事报名尚未开放或已经结束", icon: "none" });
      return;
    }
    wx.navigateTo({ url: `/pages/event-register/event-register?id=${this.data.id}` });
  },
}));
