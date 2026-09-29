const share = require("../../shared/share");
const api = require("../../utils/api");
const { cleanText } = require("../../shared/review-text");

const statusText = {
  published: "已上架",
  draft: "草稿",
  offline: "已下架"
};

const roleText = {
  super_admin: "超级管理员",
  admin: "管理员",
  operator: "运营"
};

Page(share.withShare("admin", {
  data: {
    isAdmin: false,
    admin: {},
    stats: {},
    series: [],
    seriesNames: [],
    authSeriesId: "",
    authSeriesName: "",
    authPhone: "",
    form: {
      id: "",
      name: "",
      category: "内容展示",
      cover_image: "",
      description: ""
    }
  },

  onLoad() {
    this.bootstrap();
  },

  async bootstrap() {
    const status = await api.getAdminStatus().catch(() => null);
    if (!status?.is_admin) {
      this.setData({ isAdmin: false });
      return;
    }
    this.setData({
      isAdmin: true,
      admin: {
        ...status.admin,
        roleLabel: roleText[status.admin?.role] || "管理员"
      }
    });
    this.loadAdminData();
  },

  async loadAdminData() {
    const config = await api.getMiniAdminConfig();
    const all = (config.system?.all || []).map(item => ({
      ...item,
        name: cleanText(item.name, "内容"),
      category: cleanText(item.category),
      statusText: statusText[item.status] || item.status
    }));
    this.setData({
      stats: config.stats || {},
      series: all,
      seriesNames: all.map(item => item.name),
      authSeriesId: this.data.authSeriesId || (all[0] && all[0].id) || "",
      authSeriesName: this.data.authSeriesName || (all[0] && all[0].name) || ""
    });
  },

  onFormInput(event) {
    const key = event.currentTarget.dataset.key;
    this.setData({ [`form.${key}`]: event.detail.value });
  },

  resetForm() {
    this.setData({
      form: {
        id: "",
        name: "",
        category: "内容展示",
        cover_image: "",
        description: ""
      }
    });
  },

  editSeries(event) {
    const id = event.currentTarget.dataset.id;
    const item = this.data.series.find(series => String(series.id) === String(id));
    if (!item) return;
    this.setData({
      form: {
        id: item.id,
        name: item.name || "",
        category: item.category || "内容展示",
        cover_image: item.cover_image || "",
        description: item.description || ""
      }
    });
    wx.pageScrollTo({ scrollTop: 260, duration: 180 });
  },

  async saveSeries() {
    const form = this.data.form;
    if (!form.name.trim()) {
      wx.showToast({ title: "请输入内容名称", icon: "none" });
      return;
    }
    const body = {
      name: form.name.trim(),
      category: form.category.trim(),
      cover_image: form.cover_image.trim(),
      description: form.description.trim(),
      status: "published",
      teacher: "伊娃"
    };
    if (form.id) {
      await api.updateSeries(form.id, body);
      wx.showToast({ title: "已保存" });
    } else {
      await api.createSeries(body);
      wx.showToast({ title: "已创建" });
    }
    this.resetForm();
    this.loadAdminData();
  },

  async toggleSeries(event) {
    const id = event.currentTarget.dataset.id;
    const current = event.currentTarget.dataset.status;
    await api.updateSeries(id, { status: current === "published" ? "offline" : "published" });
    wx.showToast({ title: current === "published" ? "已下架" : "已上架" });
    this.loadAdminData();
  },

  selectAuthSeries(event) {
    const index = Number(event.detail.value);
    const item = this.data.series[index];
    if (!item) return;
    this.setData({ authSeriesId: item.id, authSeriesName: item.name });
  },

  onAuthPhone(event) {
    this.setData({ authPhone: event.detail.value });
  },

  async authorizePhone() {
    if (!this.data.authSeriesId || !/^1\d{10}$/.test(this.data.authPhone)) {
      wx.showToast({ title: "请选择内容并输入手机号", icon: "none" });
      return;
    }
    await api.authorizePhone(this.data.authSeriesId, this.data.authPhone);
    wx.showToast({ title: "登记成功" });
    this.setData({ authPhone: "" });
  },

  onImageError(event) {
    const path = event.currentTarget.dataset.path;
    if (path) this.setData({ [path]: "" });
  }
}));
