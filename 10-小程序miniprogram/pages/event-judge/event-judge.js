const api = require("../../utils/api");
Page({
 data: { id: "", groupId: "", playerId: "", loading: true, submitting: false, error: "", groups: [], players: [], criteria: [], total: "", locked: false },
 onLoad(options) { this.setData({ id: options.id || "" }); this.load(); },
 async load() {
  this.setData({ loading: true, error: "" });
  try {
   let path = `/events/${this.data.id}/judge`;
   if (this.data.groupId) path += `?groupId=${this.data.groupId}`;
   if (this.data.playerId) path += `&playerId=${this.data.playerId}`;
   const result = await api.request(path);
   const criteria = (result.criteria || []).map(c => ({ ...c, value: result.currentScore && result.currentScore.values[c.key] !== undefined ? String(result.currentScore.values[c.key]) : "" }));
   this.setData({ ...result, criteria, loading: false, locked: !!(result.group && result.group.scoring_status === "locked") }); this.updateTotal();
  } catch (err) { this.setData({ loading: false, error: err.message || "加载失败" }); }
 },
 openGroup(event) { this.setData({ groupId: String(event.currentTarget.dataset.id), playerId: "" }); this.load(); },
 openPlayer(event) { this.setData({ playerId: String(event.currentTarget.dataset.id) }); this.load(); },
 goBack() { if (this.data.submitting) return; this.setData(this.data.playerId ? { playerId: "" } : { groupId: "" }); this.load(); },
 onScore(event) { const index = Number(event.currentTarget.dataset.index); this.setData({ [`criteria[${index}].value`]: event.detail.value }); this.updateTotal(); },
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
});
