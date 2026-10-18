const share = require('../../shared/share');
const api = require('../../utils/api');
const DRAFT_TTL = 24 * 60 * 60 * 1000;
const fields = ['name', 'phone', 'organization', 'teacher', 'performanceTitle', 'remark'];
Page(share.withShare('event-register', {
  data: { id: null, loading: true, error: '', competition: {}, groups: [], filteredGroups: [], groupQuery: '', groupIndex: -1, groupId: '', feeText: '', name: '', phone: '', organization: '', teacher: '', performanceTitle: '', musicFilePath: '', musicFileName: '', musicPlaying: false, musicSaving: false, remark: '', submitting: false, draftMessage: '' },
  onLoad(options) { this.setData({ id: options.id }); this.loadForm(); },
  onHide() {this.saveDraft();if(this.musicContext)this.musicContext.pause();this.setData({musicPlaying:false});},
  onUnload() { this.saveDraft(); if (this.musicContext) this.musicContext.destroy(); },
  draftKey() { return `eva-event-registration:${wx.getStorageSync('memberId')}:${this.data.id}`; },
  saveDraft() {
    if (!this.draftLoaded || this.registrationCompleted) return;
    const form = {};
    fields.forEach(key => { form[key] = this.data[key]; });
    try { wx.setStorageSync(this.draftKey(), { savedAt: Date.now(), form, groupId: this.data.groupId, musicFilePath: this.data.musicFilePath, musicFileName: this.data.musicFileName }); } catch (_) {}
  },
  async loadForm() {
    this.setData({ loading: true, error: '' });
    try {
      const [detail, profile] = await Promise.all([api.getEventDetail(this.data.id), api.getMemberProfile()]);
      const member = profile.member || profile;
      this.setData({ competition: detail.competition || {}, groups: detail.groups || [], name: member.name || '', phone: member.phone || '' });
      const draft = wx.getStorageSync(this.draftKey());
      if (draft && draft.savedAt > Date.now() - DRAFT_TTL) {
        const form = {};
        fields.forEach(key => { if (typeof draft.form?.[key] === 'string') form[key] = draft.form[key]; });
        let path = '';
        try { if (draft.musicFilePath) { wx.getFileSystemManager().accessSync(draft.musicFilePath); path = draft.musicFilePath; } } catch (_) {}
        this.setData({ ...form, groupId: draft.groupId || '', musicFilePath: path, musicFileName: path ? draft.musicFileName : '', draftMessage: '已恢复未提交的报名信息，请确认后继续。' });
      }
      this.draftLoaded = true;
      this.filterGroups();
    } catch (err) { this.setData({ error: err.message || '报名信息加载失败' }); }
    finally { this.setData({ loading: false }); }
  },
  filterGroups() {
    const query = this.data.groupQuery.trim().toLowerCase();
    const filteredGroups = this.data.groups.filter(group => !query || `${group.name} ${group.category || ''} ${group.danceType || ''} ${group.ageRange || ''}`.toLowerCase().includes(query));
    const selected = this.data.groups.find(g => String(g.id) === String(this.data.groupId));
    this.setData({ filteredGroups, groupIndex: filteredGroups.findIndex(g => String(g.id) === String(this.data.groupId)), selectedGroupName: selected?.name || '', feeText: selected ? `¥${Number(selected.registrationFee || 0).toFixed(2)}` : '' });
  },
  onGroupSearch(event) { this.setData({ groupQuery: event.detail.value || '' }); this.filterGroups(); },
  onGroupChange(event) {
    const group = this.data.filteredGroups[Number(event.detail.value)];
    if (!group) return;
    this.setData({ groupId: String(group.id) }); this.filterGroups(); this.saveDraft();
  },
  onInput(event) { const key = event.currentTarget.dataset.field; if (fields.includes(key)) { this.setData({ [key]: event.detail.value || '' }); this.saveDraft(); } },
  chooseMusic() {
    if (this.data.musicSaving || this.data.submitting) return;
    wx.chooseMessageFile({ count: 1, type: 'file', extension: ['mp3', 'wav', 'm4a', 'aac', 'flac'], success: result => {
      const file = result.tempFiles?.[0]; if (!file) return;
      if (Number(file.size) > 10 * 1024 * 1024 || !/\.(mp3|wav|m4a|aac|flac)$/i.test(file.name || '')) return wx.showToast({ title: '请选择10MB以内的音乐文件', icon: 'none' });
      if (this.musicContext) this.musicContext.stop();
      this.setData({ musicSaving: true, musicPlaying: false });
      const use = path => { this.setData({ musicFilePath: path, musicFileName: file.name, musicSaving: false }); this.saveDraft(); };
      // Keep the selected file across returning to WeChat chats or reopening the form.
      wx.saveFile({ tempFilePath: file.path, success: saved => {
        const old = this.data.musicFilePath;
        use(saved.savedFilePath);
        if (old && old !== saved.savedFilePath) wx.removeSavedFile({ filePath: old, fail() {} });
      }, fail: () => { use(file.path); wx.showToast({ title: '请在本次页面内完成报名', icon: 'none' }); } });
    } });
  },
  previewMusic() {
    if (!this.data.musicFilePath) return;
    if (!this.musicContext) {
      this.musicContext = wx.createInnerAudioContext();
      this.musicContext.onEnded(() => this.setData({ musicPlaying: false }));
      this.musicContext.onError(() => { this.setData({ musicPlaying: false }); wx.showToast({ title: '音乐暂时无法试听', icon: 'none' }); });
    }
    if (this.data.musicPlaying) this.musicContext.pause();
    else { this.musicContext.src = this.data.musicFilePath; this.musicContext.play(); }
    this.setData({ musicPlaying: !this.data.musicPlaying });
  },
  async submit() {
    if (this.data.submitting || this.data.musicSaving) return;
    const group = this.data.groups.find(g => String(g.id) === String(this.data.groupId));
    if (!group) return wx.showToast({ title: '请选择参赛组别', icon: 'none' });
    if (!this.data.name.trim() || !/^1[3-9]\d{9}$/.test(this.data.phone.trim())) return wx.showToast({ title: '请填写姓名和正确手机号', icon: 'none' });
    if (!this.data.performanceTitle.trim()) return wx.showToast({ title: '请填写节目名称', icon: 'none' });
    if (!this.data.musicFilePath) return wx.showToast({ title: '请选择需要上传的音乐文件', icon: 'none' });
    if (!this.data.competition.registrationOpen && this.data.competition.registrationStatus !== 'open') return wx.showToast({ title: '赛事报名已关闭', icon: 'none' });
    this.setData({ submitting: true });
    try {
      const body = { groupId: group.id, musicFileName: this.data.musicFileName };
      fields.forEach(key => { body[key] = this.data[key].trim(); });
      const result = await api.registerEventWithMusic(this.data.id, this.data.musicFilePath, body);
      this.registrationCompleted = true;
      wx.removeStorageSync(this.draftKey());
      if(this.data.musicFilePath)wx.removeSavedFile({filePath:this.data.musicFilePath,fail(){}});
      if (this.musicContext) this.musicContext.stop();
      if (Number(result.registrationFee) > 0) {
        wx.redirectTo({ url: `/pages/course-checkout/course-checkout?kind=event&id=${encodeURIComponent(result.registrationId || result.id)}` });
      } else wx.showModal({ title: '报名及音乐已提交', content: '本组别无需缴费，可在个人中心查看报名记录。', showCancel: false, success: () => wx.switchTab({ url: '/pages/profile/profile' }) });
    } catch (err) { wx.showToast({ title: err.message || '赛事报名失败', icon: 'none' }); }
    finally { this.setData({ submitting: false }); }
  }
}));
