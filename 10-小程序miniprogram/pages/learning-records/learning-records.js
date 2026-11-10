const api = require('../../utils/api');
const share = require('../../shared/share');

const titles = { notes: '学习笔记', bookmarks: '学习书签', growth: '成长档案' };

function timeLabel(seconds) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  return Math.floor(value / 60) + ':' + String(value % 60).padStart(2, '0');
}

Page(share.withShare('learning-records', {
  data: { kind: 'notes', title: '', loading: true, error: '', rows: [], growth: null },
  onLoad(options) {
    const kind = Object.keys(titles).includes(options.kind) ? options.kind : 'notes';
    this.setData({ kind, title: titles[kind] });
    wx.setNavigationBarTitle({ title: titles[kind] });
  },
  onShow() { return this.reload(); },
  onHide() { this.invalidate(); },
  onUnload() { this.invalidate(); },
  invalidate() {
    this.requestId = (this.requestId || 0) + 1;
    this.setData({ rows: [], growth: null, error: '', loading: true });
  },
  onPullDownRefresh() { return this.reload().finally(() => wx.stopPullDownRefresh()); },
  async reload() {
    const requestId = this.requestId = (this.requestId || 0) + 1;
    const member = wx.getStorageSync('memberId');
    const token = wx.getStorageSync('token');
    const active = () => requestId === this.requestId && member === wx.getStorageSync('memberId') && token === wx.getStorageSync('token');
    this.setData({ loading: true, error: '', rows: [], growth: null });
    if (!member || !token) {
      this.setData({ loading: false, error: '请登录后查看学习记录', loginRequired: true });
      return;
    }
    this.setData({ loginRequired: false });
    const kind = this.data.kind;
    try {
      if (kind === 'growth') {
        const result = await api.getMemberGrowth();
        if (!active()) return;
        if (!result || !result.growth || !Array.isArray(result.ledger)) throw new Error('成长档案暂时无法加载');
        const growth = result.growth;
        this.setData({
          growth: {
            level: growth.level_display || '学员',
            points: Number(growth.experience_total || 0),
            progress: Math.min(100, Math.max(0, Number(growth.level_progress_percent) || 0)),
            nextLevel: growth.next_level_name || '',
            remaining: Number(growth.points_to_next_level || 0),
            academyAge: growth.academy_age?.text || ''
          },
          rows: result.ledger.map(row => ({
            id: row.id, title: row.description || '经验变动',
            date: String(row.occurred_at || '').slice(0, 10),
            points: (Number(row.points_delta) > 0 ? '+' : '') + String(row.points_delta || 0)
          }))
        });
      } else {
        const result = await (kind === 'notes' ? api.getAllNotes() : api.getAllBookmarks());
        if (!active()) return;
        if (!Array.isArray(result)) throw new Error('学习记录暂时无法加载');
        this.setData({ rows: result.map(row => ({
          id: row.id,
          title: row.video_name || row.course_name || '课节',
          context: row.series_name || '',
          text: kind === 'notes' ? row.content || '' : row.label || '',
          time: timeLabel(row.timestamp_seconds),
          date: String(row.created_at || '').slice(0, 10)
        })) });
      }
    } catch (err) {
      if (active()) this.setData({ error: err.message || '学习记录暂时无法加载，请重试', loginRequired: Number(err.statusCode) === 401 });
    } finally {
      if (active()) this.setData({ loading: false });
      else if (requestId === this.requestId) this.setData({ loading: false, rows: [], growth: null, error: '登录状态已变化，请重新加载' });
    }
  },
  goLogin() { wx.navigateTo({ url: '/pages/login/login?returnTab=profile' }); }
}));
