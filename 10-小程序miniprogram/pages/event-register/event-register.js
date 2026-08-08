const api = require("../../utils/api");

Page({
  data: {
    id: null, competition: {}, groups: [], groupIndex: -1,
    name: "", phone: "", organization: "", teacher: "", performanceTitle: "",
    musicFilePath: "", musicFileName: "", remark: "", submitting: false
  },
  onLoad(options) { this.setData({ id: options.id }); this.loadForm(); },
  async loadForm() {
    wx.showLoading({ title: "加载中" });
    try {
      const [detail, profile] = await Promise.all([api.getEventDetail(this.data.id), api.getMemberProfile().catch(() => null)]);
      const member = profile && profile.member || profile || {};
      this.setData({ competition: detail.competition || {}, groups: detail.groups || [], name: member.name || wx.getStorageSync("memberName") || "", phone: member.phone || "" });
    } catch (err) {
      wx.showToast({ title: err.message || "报名信息加载失败", icon: "none" });
    } finally { wx.hideLoading(); }
  },
  onGroupChange(event) { this.setData({ groupIndex: Number(event.detail.value) }); },
  onInput(event) { this.setData({ [event.currentTarget.dataset.field]: event.detail.value || "" }); },
  chooseMusic() {
    wx.chooseMessageFile({
      count: 1,
      type: "file",
      extension: ["mp3", "wav", "m4a", "aac", "flac"],
      success: (result) => {
        const file = result.tempFiles && result.tempFiles[0];
        if (!file) return;
        if (Number(file.size || 0) > 10 * 1024 * 1024) {
          wx.showToast({ title: "音乐文件不能超过10MB", icon: "none" });
          return;
        }
        this.setData({ musicFilePath: file.path, musicFileName: file.name || "已选择音乐文件" });
      }
    });
  },
  async submit() {
    if (this.data.submitting) return;
    if (this.data.groupIndex < 0) return wx.showToast({ title: "请选择参赛组别", icon: "none" });
    if (!String(this.data.name).trim() || !/^1[3-9]\d{9}$/.test(String(this.data.phone).trim())) return wx.showToast({ title: "请填写姓名和正确手机号", icon: "none" });
    if (!String(this.data.performanceTitle).trim()) return wx.showToast({ title: "请填写参赛曲目", icon: "none" });
    if (!this.data.musicFilePath) return wx.showToast({ title: "请选择需要上传的音乐文件", icon: "none" });
    this.setData({ submitting: true });
    try {
      await api.registerEventWithMusic(this.data.id, this.data.musicFilePath, {
        groupId: this.data.groups[this.data.groupIndex].id, name: String(this.data.name).trim(), phone: String(this.data.phone).trim(),
        organization: String(this.data.organization).trim(), teacher: String(this.data.teacher).trim(),
        performanceTitle: String(this.data.performanceTitle).trim(), remark: String(this.data.remark).trim()
      });
      wx.showModal({
        title: "报名提交成功",
        content: "工作人员将尽快联系您确认组别与缴费事宜，可在个人中心查看报名状态。",
        showCancel: false,
        success: () => wx.switchTab({ url: "/pages/profile/profile" })
      });
    } catch (err) {
      wx.showToast({ title: err.message || "赛事报名失败", icon: "none" });
    } finally { this.setData({ submitting: false }); }
  }
});
