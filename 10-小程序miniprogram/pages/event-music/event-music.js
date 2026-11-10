const api = require('../../utils/api');
const { pendingMusicKey } = require('../../shared/event-music-draft');
const share = require('../../shared/share');
const editableFields = ['name', 'phone', 'countryCode', 'organization', 'teacher', 'performanceTitle', 'remark'];
Page(share.withShare('event-music', {
  data: { id: '', fileName: '', filePath: '', currentFileName: '', loading: true, canEdit: false, saving: false, error: '', details: {}, detailFields: [{key:'name',label:'参赛姓名',limit:120},{key:'countryCode',label:'国家/地区区号',limit:4},{key:'phone',label:'手机号码',limit:20},{key:'organization',label:'机构 / 舞蹈室',limit:100},{key:'teacher',label:'指导老师',limit:60},{key:'performanceTitle',label:'节目（音乐）名字',limit:120}] },
  onLoad(options) {
    const id = String(options.id || '');
    if (!/^[\w-]{1,100}$/.test(id)) return this.setData({ loading: false, error: '报名记录不存在' });
    this.setData({ id });
    return this.load();
  },
  async load() {
    if (!this.data.id || this.data.saving) return;
    this.setData({ loading: true, error: '', canEdit: false, filePath: '', fileName: '' });
    try {
      const [result, details] = await Promise.all([api.request(`/member/event-registrations/${encodeURIComponent(this.data.id)}/music`), api.request(`/member/event-registrations/${encodeURIComponent(this.data.id)}`)]);
      this.accountId = String(wx.getStorageSync('memberId'));
      this.draftKey = pendingMusicKey(this.accountId, this.data.id);
      const pending = wx.getStorageSync(this.draftKey);
      if (pending?.path) {
        try {
          wx.getFileSystemManager().accessSync(pending.path);
          this.setData({ filePath: pending.path, fileName: pending.name });
        } catch (_) {}
      }
      this.setData({ currentFileName: result.fileName || '', canEdit: result.canEdit, details });
    } catch (error) { this.setData({ error: error.message || '加载失败，请重试' }); }
    finally { this.setData({ loading: false }); }
  },
  onDetailsInput(event) {
    const key = event.currentTarget.dataset.field;
    if (editableFields.includes(key)) this.setData({ details: { ...this.data.details, [key]: event.detail.value } });
  },
  async saveDetails() {
    if (this.data.saving || !this.data.canEdit || String(wx.getStorageSync('memberId')) !== this.accountId) return;
    this.setData({ saving: true, error: '' });
    try {
      const input = Object.fromEntries(editableFields.map(key => [key, this.data.details[key] || '']));
      const details = await api.request(`/member/event-registrations/${encodeURIComponent(this.data.id)}`, { method: 'PUT', data: input, retry: false });
      this.setData({ details });
      wx.showToast({ title: '报名信息已保存', icon: 'success' });
    } catch (error) { this.setData({ error: error.message || '保存失败，请重试' }); }
    finally { this.setData({ saving: false }); }
  },
  chooseMusic() {
    if (this.data.saving) return;
    wx.chooseMessageFile({ count: 1, type: 'file', success: result => {
      const file = result.tempFiles && result.tempFiles[0];
      if (!file) return;
      if (!file.size || file.size > 10 * 1024 * 1024 || !/\.(mp3|wav|m4a|aac|flac)$/i.test(file.name || '')) {
        this.setData({ error: '请选择10MB以内的 MP3、WAV、M4A、AAC 或 FLAC 文件' }); return;
      }
      this.setData({ fileName: file.name, filePath: file.path, error: '' });
    }, fail: error => { if (!/cancel/i.test(error.errMsg || '')) this.setData({ error: '文件选择失败，请重试' }); } });
  },
  async save() {
    if (this.data.saving || !this.data.canEdit || String(wx.getStorageSync('memberId')) !== this.accountId) return;
    const title = String(this.data.details.performanceTitle || '').trim();
    if (!title || !this.data.filePath) { this.setData({ error: '请填写节目（音乐）名字并选择音乐文件' }); return; }
    this.setData({ saving: true, error: '' });
    try {
      const result = await api.replaceEventMusic(this.data.id, this.data.filePath, { performanceTitle: title, musicFileName: this.data.fileName });
      const pending = wx.getStorageSync(this.draftKey);
      if (pending?.path) wx.removeSavedFile({ filePath: pending.path, fail() {} });
      try { wx.removeStorageSync(this.draftKey); } catch (_) {}
      this.setData({ details: { ...this.data.details, performanceTitle: result.performanceTitle || title }, currentFileName: result.fileName, fileName: '', filePath: '' });
      wx.showToast({ title: '音乐已更新', icon: 'success' });
    } catch (error) { this.setData({ error: error.message || '上传失败，请重试' }); }
    finally { this.setData({ saving: false }); }
  }
}));
