const api = require('../../utils/api');
const share = require('../../shared/share');
const videoFeature = require('../../shared/video-feature');
const { messageTarget } = require('../../shared/message-target');
const labels = { welcome: '欢迎', growth: '成长', level_up: '升级', course: '线上课程', offline: '线下课程', consume: '核销', certificate: '证书', event: '赛事', system: '系统' };
function normalize(item) {
  return { ...item, recipientId: String(item.recipientId), typeLabel: labels[item.type] || '通知', timeText: String(item.createdAt || '').replace('T', ' ').slice(0, 16), target: messageTarget(item) };
}
Page(share.withShare('messages', {
  data: { items: [], unreadCount: 0, filter: 'all', nextCursor: 0, hasMore: false, loading: false, error: '', selected: null, marking: false,
    filters: [{key:'all',label:'全部'},{key:'unread',label:'未读'},{key:'course',label:'课程'},{key:'growth',label:'成长'},{key:'system',label:'系统'}] },
  onShow() { this.visible = true; this.setData({ items: [], selected: null, unreadCount: 0 }); return this.loadMessages(); },
  onHide() { this.visible = false; this.requestId = (this.requestId || 0) + 1; this.setData({ loading: false, selected: null }); },
  onUnload() { this.visible = false; this.requestId = (this.requestId || 0) + 1; },
  onPullDownRefresh() { return this.loadMessages().finally(() => wx.stopPullDownRefresh()); },
  onReachBottom() { if (this.data.hasMore && !this.data.loading) return this.loadMessages(true); },
  async loadMessages(append = false) {
    if (append && (this.data.loading || !this.data.hasMore)) return;
    const requestId = this.requestId = (this.requestId || 0) + 1;
    const filter = this.data.filter;
    this.setData({ loading: true, error: '' });
    try {
      const result = await api.getMessages({ type: ['course','growth','system'].includes(filter) ? filter : '', status: filter === 'unread' ? 'unread' : '', cursor: append ? this.data.nextCursor : 0 });
      if (requestId !== this.requestId) return;
      const rows = (result.items || []).map(normalize), seen = new Set();
      const items = (append ? this.data.items.concat(rows) : rows).filter(item => !seen.has(item.recipientId) && seen.add(item.recipientId));
      this.setData({ items, unreadCount: Number(result.unreadCount || 0), nextCursor: Number(result.nextCursor || 0), hasMore: !!result.hasMore });
    } catch (err) {
      if (requestId === this.requestId) this.setData({ error: err.message || '通知加载失败，请重试' });
    } finally { if (requestId === this.requestId) this.setData({ loading: false }); }
  },
  refresh() { return this.loadMessages(); },
  loadMore() { return this.loadMessages(true); },
  changeFilter(event) {
    const filter = event.currentTarget.dataset.key;
    if (!this.data.filters.some(item => item.key === filter) || this.data.filter === filter) return;
    this.setData({ filter, items: [], nextCursor: 0, hasMore: false });
    return this.loadMessages();
  },
  async openMessage(event) {
    if (this.data.marking) return;
    const item = this.data.items.find(row => row.recipientId === String(event.currentTarget.dataset.id));
    if (!item) return;
    this.setData({ selected: item });
    if (item.status !== 'unread' || this.data.marking) return;
    this.setData({ marking: true });
    try {
      await api.markMessageRead(item.recipientId);
      if (this.visible === false) return;
      if (this.data.selected && this.data.selected.recipientId === item.recipientId) this.setData({ selected: { ...item, status: 'read' } });
      await this.loadMessages();
    } catch (err) { wx.showToast({title: err.message || '已读状态未同步，请重试',icon:'none'}); }
    finally { this.setData({ marking: false }); }
  },
  closeDetail() { this.setData({ selected: null }); },
  async markAllRead() {
    if (this.data.marking || !this.data.unreadCount) return;
    this.setData({ marking: true });
    try { await api.markAllMessagesRead(); if (this.visible !== false) await this.loadMessages(); }
    catch (err) { wx.showToast({title:err.message || '更新失败，请重试',icon:'none'}); }
    finally { this.setData({ marking: false }); }
  },
  openRelated() {
    const target = this.data.selected && this.data.selected.target;
    if (!target) return;
    this.closeDetail();
    if (target.tab) wx.switchTab({url:target.url});
    else videoFeature.navigateTo({url:target.url});
  }
}));
