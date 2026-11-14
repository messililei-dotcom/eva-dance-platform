const {distributeScores}=require("../../shared/score-allocation");
const api = require("../../utils/api");
const view=require("../../shared/event-view");
const share=require("../../shared/share");
Page(share.withShare("event-judge",{
 data: { id: "", groupId: "", playerId: "", loading: true, submitting: false, error: "", groups: [], players: [], visibleRows:[], query:'', pageNo:1, pageCount:1, criteria: [], total: "", filter: "all", scoredCount:0, maxTotal:10, locked: false },
 onLoad(options) { this.setData({ id: options.id || "", groupId: options.groupId || "", playerId: options.playerId || "" }); this.load(); },
 onShow() { if (this.hasShown && !this.data.playerId) this.load(); this.hasShown = true; },
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
   this.setData({ ...result, criteria, scoredCount:(result.players||[]).filter(p=>p.my_score!=null).length, maxTotal:criteria.reduce((n,c)=>n+Number(c.maxScore),0)||10, loading: false, locked: !!(result.group && result.group.scoring_status === "locked") }); this.updateTotal();this.applyPage(this.data.pageNo);
  } catch (err) { if(requestId!==this.requestId)return;this.setData({ loading: false, error: err.message || "加载失败" }); }
 },
 onSearch(event){this.setData({query:String(event.detail.value||'')});this.applyPage(1);},
 applyPage(number){const q=this.data.query.trim().toLowerCase();const source=this.data.groupId?this.data.players:this.data.groups;const rows=source.filter(r=>!this.data.groupId||this.data.filter==="all"||(this.data.filter==="scored"?r.my_score!=null:r.my_score==null)).map((r,i)=>({...r,ordinal:i+1})).filter(r=>!q||`${r.name} ${r.player_no||''}`.toLowerCase().includes(q));const page=view.page(rows,number);this.setData({visibleRows:page.rows,pageNo:page.number,pageCount:page.pages});},
 changePage(event){this.applyPage(this.data.pageNo+Number(event.currentTarget.dataset.offset));},
 openGroup(event) { wx.navigateTo({ url: `/pages/event-judge/event-judge?id=${encodeURIComponent(this.data.id)}&groupId=${encodeURIComponent(event.currentTarget.dataset.id)}` }); },
 openPlayer(event) { wx.navigateTo({ url: `/pages/event-judge/event-judge?id=${encodeURIComponent(this.data.id)}&groupId=${encodeURIComponent(this.data.groupId)}&playerId=${encodeURIComponent(event.currentTarget.dataset.id)}` }); },
 goBack() { if (this.data.submitting) return;
  const pages = getCurrentPages();
  const previous = pages[pages.length - 2];
  if (previous && previous.route === 'pages/event-judge/event-judge' && String(previous.options?.id) === String(this.data.id)) {
   wx.navigateBack(); return;
  }
  this.setData(this.data.playerId ? { playerId: "",query:"" } : { groupId: "",query:"" }); this.load(); },
 setFilter(event){this.setData({filter:event.currentTarget.dataset.filter});this.applyPage(1);},
 onSlider(event){this.onScore({currentTarget:event.currentTarget,detail:{value:(Number(event.detail.value)/100).toFixed(2)}});},
 beginTotal(){this.totalWeights=this.data.criteria.map(c=>Number(c.value)||0);},
 onTotal(event){if(this.data.locked||this.data.submitting)return;const raw=String(event.detail.value);this.setData({total:raw});if(!raw.trim()||!Number.isFinite(Number(raw))||Number(raw)<0||Number(raw)>this.data.maxTotal)return;const next=distributeScores(this.data.criteria.map(c=>c.maxScore),this.totalWeights||this.data.criteria.map(c=>Number(c.value)||0),Number(raw));this.setData({criteria:this.data.criteria.map((c,i)=>({...c,value:next[i].toFixed(2),slider:Math.round(next[i]*100),sliderMax:Math.round(c.maxScore*100)}))});},
 onScore(event) {
  if(this.data.locked||this.data.submitting)return;
  const index = Number(event.currentTarget.dataset.index);
  if (!Number.isInteger(index) || !this.data.criteria[index]) return;
  const criteria = this.data.criteria.map((criterion, position) =>
   position === index ? { ...criterion, value: event.detail.value } : criterion
  );
  this.setData({ criteria });
  this.updateTotal();
 },
 updateTotal() { const total = this.data.criteria.reduce((sum,c) => sum + (Number(c.value) || 0),0); this.setData({ total: total.toFixed(2),criteria:this.data.criteria.map(c=>({...c,slider:Math.min(Math.round(c.maxScore*100),Math.max(0,Math.round((Number(c.value)||0)*100))),sliderMax:Math.round(c.maxScore*100)})) }); },
 async submit() {
  if (this.data.submitting || this.data.locked || !this.data.criteria.length) return;
  if(!String(this.data.total).trim()||!Number.isFinite(Number(this.data.total))||Number(this.data.total)<0||Number(this.data.total)>this.data.maxTotal){wx.showToast({title:"请填写有效总分",icon:"none"});return;}
  const scores = {};
  for (const c of this.data.criteria) {
   if (String(c.value).trim() === "" || !Number.isFinite(Number(c.value)) || Number(c.value)<0 || Number(c.value)>c.maxScore) { wx.showToast({ title: `请填写${c.name}（0–${c.maxScore}分）`, icon: "none" }); return; }
   scores[c.key] = Number(c.value);
  }
  this.updateTotal();
  this.setData({ submitting: true });
  const confirmed=await new Promise(resolve=>wx.showModal({title:"确认提交本人评分？",content:`${this.data.player.name} · 合计 ${this.data.total} 分`,success:r=>resolve(r.confirm),fail:()=>resolve(false)}));
  if(!confirmed){this.setData({submitting:false});return;}
  try {
   await api.request(`/events/${this.data.id}/judge?groupId=${this.data.groupId}&playerId=${this.data.playerId}`, { method: "POST", data: { scores } });
   wx.showToast({ title: "评分已提交", icon: "success" }); await this.load();
  } catch (err) { wx.showToast({ title: err.message || "提交失败", icon: "none" }); }
  finally { this.setData({ submitting: false }); }
 }
}));
