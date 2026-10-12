const api = require("../../utils/api");
const view=require("../../shared/event-view");
const share=require("../../shared/share");
Page(share.withShare("event-judge",{
 data: { id: "", groupId: "", playerId: "", loading: true, submitting: false, error: "", groups: [], players: [], visibleRows:[], query:'', pageNo:1, pageCount:1, criteria: [], total: "", locked: false },
 onLoad(options) { this.setData({ id: options.id || "" }); this.load(); },
 async load() {
  const requestId=this.requestId=(this.requestId||0)+1;
  this.setData({ loading: true, error: "" });
  try {
   let path = `/events/${this.data.id}/judge`;
   if (this.data.groupId) path += `?groupId=${this.data.groupId}`;
   if (this.data.playerId) path += `&playerId=${this.data.playerId}`;
   const result = await api.request(path);
   if(requestId!==this.requestId)return;
   const criteria = (result.criteria || []).map(c => ({ ...c, value: result.currentScore && result.currentScore.values[c.key] !== undefined ? String(result.currentScore.values[c.key]) : "" }));
   this.setData({ ...result, criteria, loading: false, locked: !!(result.group && result.group.scoring_status === "locked") }); this.updateTotal();this.applyPage(1);
  } catch (err) { if(requestId!==this.requestId)return;this.setData({ loading: false, error: err.message || "加载失败" }); }
 },
 onSearch(event){this.setData({query:String(event.detail.value||'')});this.applyPage(1);},
 applyPage(number){const q=this.data.query.trim().toLowerCase();const source=this.data.groupId?this.data.players:this.data.groups;const rows=source.map((r,i)=>({...r,ordinal:i+1})).filter(r=>!q||`${r.name} ${r.player_no||''}`.toLowerCase().includes(q));const page=view.page(rows,number);this.setData({visibleRows:page.rows,pageNo:page.number,pageCount:page.pages});},
 changePage(event){this.applyPage(this.data.pageNo+Number(event.currentTarget.dataset.offset));},
 openGroup(event) { this.setData({ groupId: String(event.currentTarget.dataset.id), playerId: "",query:"",players:[] }); this.load(); },
 openPlayer(event) { this.setData({ playerId: String(event.currentTarget.dataset.id) }); this.load(); },
 goBack() { if (this.data.submitting) return; this.setData(this.data.playerId ? { playerId: "",query:"" } : { groupId: "",query:"" }); this.load(); },
 onScore(event) { const index = Number(event.currentTarget.dataset.index); this.setData({ [`criteria[${index}].value`]: event.detail.value }); this.updateTotal();this.applyPage(1); },
 updateTotal() { const total = this.data.criteria.reduce((sum,c) => sum + (Number(c.value) || 0),0); this.setData({ total: total.toFixed(2) }); },
 async submit() {
  if (this.data.submitting || this.data.locked) return;
  const scores = {};
  for (const c of this.data.criteria) {
   if (String(c.value).trim() === "" || !Number.isFinite(Number(c.value)) || Number(c.value)<0 || Number(c.value)>c.maxScore) { wx.showToast({ title: `请填写${c.name}（0–${c.maxScore}分）`, icon: "none" }); return; }
   scores[c.key] = Number(c.value);
  }
  this.setData({ submitting: true });
  try {
   await api.request(`/events/${this.data.id}/judge?groupId=${this.data.groupId}&playerId=${this.data.playerId}`, { method: "POST", data: { scores } });
   wx.showToast({ title: "评分已提交", icon: "success" }); await this.load();
  } catch (err) { wx.showToast({ title: err.message || "提交失败", icon: "none" }); }
  finally { this.setData({ submitting: false }); }
 }
}));
