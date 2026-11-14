const { PHONE_COUNTRIES, normalizeEventPhone } = require('../../shared/event-phone');
const share = require('../../shared/share');
const api = require('../../utils/api');
const { requestKey } = require('../../shared/shop');
const { pendingMusicKey } = require('../../shared/event-music-draft');
const DRAFT_TTL = 24 * 60 * 60 * 1000;
const fields = ['name', 'phone', 'countryCode', 'organization', 'teacher', 'performanceTitle', 'remark'];
Page(share.withShare('event-register', {
  data: { queued: [], confirmed: null, uploadingId: null, uploadProgress: 0, id: null, loading: true, error: '', competition: {}, groups: [], filteredGroups: [], groupQuery: '', groupIndex: -1, groupId: '', feeText: '', name: '', phone: '', countryCode: '+86', countryFlag: '🇨🇳', countryOptions: PHONE_COUNTRIES.map(item => ({ ...item, label: item.flag + ' ' + item.name + ' ' + item.code })), organization: '', teacher: '', performanceTitle: '', musicFilePath: '', musicFileName: '', musicPlaying: false, musicSaving: false, musicError: '', remark: '', submitting: false, draftMessage: '' },
  onLoad(options) { this.setData({ id: options.id }); this.loadForm(); },
  onHide() {this.saveDraft();if(this.musicContext)this.musicContext.pause();this.setData({musicPlaying:false});},
  onUnload() { this.saveDraft(); if (this.musicContext) this.musicContext.destroy(); },
  draftKey() { return `eva-event-registration:${this.accountId}:${this.data.id}`; },
  saveDraft() {
    if (!this.draftLoaded || this.registrationCompleted) return;
    const form = {};
    fields.forEach(key => { form[key] = this.data[key]; });
    try { wx.setStorageSync(this.draftKey(), { savedAt: Date.now(), form, groupId: this.data.groupId, musicFilePath: this.data.musicFilePath, musicFileName: this.data.musicFileName, queued: this.data.queued, submission: this.submission }); } catch (_) {}
  },
  async loadForm() {
    this.setData({ loading: true, error: '' });
    try {
      const [detail, profile] = await Promise.all([api.getEventDetail(this.data.id), api.getMemberProfile()]);
      const member = profile.member || profile;
      this.setData({ competition: detail.competition || {}, groups: detail.groups || [], name: member.name || '', phone: member.phone || '' });
      this.accountId = String(wx.getStorageSync('memberId'));
      if (member.id && String(member.id) !== this.accountId) throw new Error('登录账户已切换，请重新加载');
      const draft = wx.getStorageSync(this.draftKey());
      if (draft && draft.savedAt > Date.now() - DRAFT_TTL) {
        const form = {};
        fields.forEach(key => { if (typeof draft.form?.[key] === 'string') form[key] = draft.form[key]; });
        let path = '';
        try { if (draft.musicFilePath) { wx.getFileSystemManager().accessSync(draft.musicFilePath); path = draft.musicFilePath; } } catch (_) {}
        this.submission = draft.submission;
        const queued = Array.isArray(draft.queued) ? draft.queued.map(row => {
          if (row.filePath) {
            try { wx.getFileSystemManager().accessSync(row.filePath); } catch (_) { return { ...row, filePath: '', fileName: '' }; }
          }
          return row;
        }) : [];
        this.setData({ ...form, queued, groupId: draft.groupId || '', musicFilePath: path, musicFileName: path ? draft.musicFileName : '', draftMessage: '已恢复未提交的报名信息，请确认后继续。' });
      }
      this.draftLoaded = true;
      this.syncPhoneFields();
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
    if (this.data.submitting || this.data.musicSaving) return;
    const group = this.data.filteredGroups[Number(event.detail.value)];
    if (!group) return;
    this.setData({ groupId: String(group.id) }); this.filterGroups(); this.saveDraft();
  },
  syncPhoneFields() {
    try {
      const normalized = normalizeEventPhone(this.data.phone, this.data.countryCode);
      this.setData({ phone: normalized.nationalNumber, countryCode: normalized.countryCode });
    } catch (_) {}
    this.setData({ countryFlag: (PHONE_COUNTRIES.find(item => item.code === this.data.countryCode) || {}).flag || '🌐' });
  },
  onPhoneBlur() { this.syncPhoneFields(); this.saveDraft(); },
  onCountryChange(event) {
    if (this.data.submitting) return;
    const country = PHONE_COUNTRIES[Number(event.detail.value)];
    if (country) this.setData({ countryCode: country.code, countryFlag: country.flag });
    this.saveDraft();
  },
  onInput(event) { if (this.data.submitting) return; const key = event.currentTarget.dataset.field; if (fields.includes(key)) { this.setData({ [key]: event.detail.value || '' }); if (key === 'countryCode') this.setData({ countryFlag: (PHONE_COUNTRIES.find(item => item.code === this.data.countryCode) || {}).flag || '🌐' }); this.saveDraft(); } },
  chooseMusic() {
    if (this.data.musicSaving || this.data.submitting) return;
    wx.chooseMessageFile({ count: 1, type: 'file', success: result => {
      const file = result.tempFiles?.[0]; if (!file) return;
      if (!Number(file.size) || Number(file.size) > 10 * 1024 * 1024 || !/\.(mp3|wav|m4a|aac|flac)$/i.test(file.name || '')) return wx.showToast({ title: '请选择10MB以内的音乐文件', icon: 'none' });
      if (this.musicContext) this.musicContext.stop();
      this.setData({ musicSaving: true, musicPlaying: false, musicError: '' });
      const use = path => { this.setData({ musicFilePath: path, musicFileName: file.name, musicSaving: false }); this.saveDraft(); };
      // Keep the selected file across returning to WeChat chats or reopening the form.
      wx.saveFile({ tempFilePath: file.path, success: saved => {
        const old = this.data.musicFilePath;
        use(saved.savedFilePath);
        if (old && old !== saved.savedFilePath) wx.removeSavedFile({ filePath: old, fail() {} });
      }, fail: () => { use(file.path); wx.showToast({ title: '请在本次页面内完成报名', icon: 'none' }); } });
    }, fail: error => {
      if (/cancel/i.test(error.errMsg || '')) return;
      this.setData({ musicError: '音乐文件选择失败，请确认音乐已作为文件发送到微信聊天或文件传输助手，然后重试。' });
      wx.showToast({ title: '文件选择失败，请重试', icon: 'none' });
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
  currentEntry() {
    const group = this.data.groups.find(g => String(g.id) === String(this.data.groupId));
    if (!group) throw new Error('请选择参赛组别');
    if (!this.data.name.trim() || this.data.name.trim().length > 120) throw new Error('请填写1至120个字符的选手姓名');
    normalizeEventPhone(this.data.phone, this.data.countryCode);
    if (!this.data.performanceTitle.trim()) throw new Error('请填写节目（音乐）名字');
    const body = { groupId: group.id };
    fields.forEach(key => { body[key] = this.data[key].trim(); });
    return { body, groupName: group.name, feeText: this.data.feeText, filePath: this.data.musicFilePath, fileName: this.data.musicFileName };
  },
  queueEntry() {
    if (this.data.submitting || this.data.musicSaving || this.data.confirmed) return;
    try {
      if (this.data.queued.length >= 19) throw new Error('单次最多提交20条报名');
      const row = this.currentEntry();
      if (this.musicContext) this.musicContext.stop();
      this.setData({
        queued: [...this.data.queued, { ...row, draftId: requestKey() }], groupId: '', groupQuery: '', performanceTitle: '',
        remark: '', musicFilePath: '', musicFileName: '', musicPlaying: false, musicError: '',
      });
      this.filterGroups();
      this.saveDraft();
    } catch (error) { this.setData({ musicError: error.message }); }
  },
  removeEntry(event) {
    if (this.data.submitting || this.data.musicSaving) return;
    const index = Number(event.currentTarget.dataset.index);
    const row = this.data.queued[index];
    if (!row) return;
    if (row.filePath) wx.removeSavedFile({ filePath: row.filePath, fail() {} });
    this.setData({ queued: this.data.queued.filter((_, i) => i !== index) });
    this.saveDraft();
  },
  async submit() {
    if (this.data.submitting || this.data.musicSaving || this.data.confirmed) return;
    if (String(wx.getStorageSync('memberId')) !== this.accountId) {
      this.setData({ musicError: '登录账户已切换，请返回重新打开报名页' });
      return;
    }
    let rows = this.data.queued;
    try {
      if (!require('../../shared/event-state').eventState(this.data.competition).registrationOpen && !this.submission) throw new Error('赛事当前未开放报名');
      if (!rows.length || this.data.groupId || this.data.performanceTitle.trim() || this.data.musicFilePath || this.data.remark.trim()) {
        rows = [...rows, this.currentEntry()];
      }
      const entries = rows.map(row => row.body);
      const fingerprint = JSON.stringify(entries);
      if (this.submission?.fingerprint !== fingerprint) this.submission = { fingerprint, key: requestKey() };
      this.saveDraft();
      this.setData({ submitting: true, musicError: '' });
      const result = await api.registerEventBatch(this.data.id, entries, this.submission.key);
      if (String(wx.getStorageSync('memberId')) !== this.accountId) throw new Error('登录账户已切换，请返回重新打开报名页');
      this.registrationCompleted = true;
      const registrations = result.registrations.map((registration, index) => ({
        ...rows[index], id: registration.id,
      }));
      for (const row of registrations) {
        if (!row.filePath) continue;
        try { wx.setStorageSync(pendingMusicKey(this.accountId, row.id), { path: row.filePath, name: row.fileName }); } catch (_) {}
      }
      try { wx.removeStorageSync(this.draftKey()); } catch (_) {}
      if (this.musicContext) this.musicContext.stop();
      this.setData({ confirmed: { registrations, paymentId: result.paymentRegistrationId } });
      if (wx.pageScrollTo) wx.pageScrollTo({ scrollTop: 0, duration: 0 });
    } catch (error) { this.setData({ musicError: error.message || '报名提交失败，请重试' }); }
    finally { this.setData({ submitting: false }); }
  },
  async uploadMusic(event) {
    if (this.data.uploadingId || String(wx.getStorageSync('memberId')) !== this.accountId) return;
    const index = Number(event.currentTarget.dataset.index);
    const row = this.data.confirmed.registrations[index];
    if (!row?.filePath) return;
    this.setData({ uploadingId: row.id, uploadProgress: 0, musicError: '' });
    try {
      await api.replaceEventMusic(row.id, row.filePath, {
        performanceTitle: row.body.performanceTitle, musicFileName: row.fileName,
      }, uploadProgress => this.setData({ uploadProgress }));
      wx.removeSavedFile({ filePath: row.filePath, fail() {} });
      try { wx.removeStorageSync(pendingMusicKey(this.accountId, row.id)); } catch (_) {}
      this.setData({ [`confirmed.registrations[${index}].filePath`]: '', [`confirmed.registrations[${index}].uploaded`]: true });
    } catch (error) {
      this.setData({ musicError: error.message || '音乐上传失败，请重试' });
    } finally { this.setData({ uploadingId: null }); }
  },
  payRegistrations() {
    if (this.data.uploadingId || String(wx.getStorageSync('memberId')) !== this.accountId) return;
    wx.redirectTo({ url: '/pages/course-checkout/course-checkout?kind=event&id=' + encodeURIComponent(this.data.confirmed.paymentId) });
  },
  openProfile() {
    if (!this.data.uploadingId) wx.switchTab({ url: '/pages/profile/profile' });
  },
}));
