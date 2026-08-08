const api = require("../../utils/api");
const app = getApp();

Page({
  data: {
    loading: true,
    name: "",
    phone: "",
    gender: "",
    genderText: "未知",
    birthday: "",
    country: "",
    province: "",
    city: "",
    address: "",
    regionText: "",
    regionValues: [],
    remark: "",
    level: "",
    levelText: "",
    registeredAt: "",
    avatarUrl: "",
    displayInitial: "伊",
  },

  saveTimer: null,

  onShow() {
    this.loadProfile();
  },

  formatLevel(level) {
    const raw = String(level || "").trim();
    if (!raw) return "普通学员";
    const map = { vip: "VIP 学员", svip: "SVIP 学员", normal: "普通学员", regular: "普通学员", beginner: "基础学员", advanced: "进阶学员" };
    return map[raw.toLowerCase()] || raw;
  },

  async loadProfile() {
    this.setData({ loading: true });
    try {
      const profile = await api.getMemberProfile().catch(() => null);
      const member = profile?.member || profile || {};
      const regionText = [member.province, member.city].filter(Boolean).join(" / ");
      this.setData({
        name: member.name || "",
        phone: member.phone || "",
        gender: member.gender || "",
        genderText: member.gender || "未知",
        birthday: member.birthday || "",
        country: member.country || "中国",
        province: member.province || "",
        city: member.city || "",
        address: member.address || "",
        regionText: regionText || "",
        regionValues: [member.country || "中国", member.province || "", member.city || ""],
        remark: member.remark || "",
        level: member.level || "",
        levelText: this.formatLevel(member.level),
        registeredAt: member.register_date || member.created_at || "",
        avatarUrl: member.avatar_url || member.wx_avatar_url || "",
        displayInitial: ((member.wx_nickname || member.name || "")[0] || "伊"),
        loading: false,
      });
    } catch (err) {
      wx.showToast({ title: "加载失败", icon: "none" });
      this.setData({ loading: false });
    }
  },

  onNameInput(e) {
    this.setData({ name: e.detail.value });
    this.debouncedSave({ name: e.detail.value });
  },

  onPhoneInput(e) {
    const phone = e.detail.value.replace(/\D/g, '').slice(0, 11);
    this.setData({ phone });
  },

  onBirthdayInput(e) {
    this.setData({ birthday: e.detail.value });
    this.debouncedSave({ birthday: e.detail.value });
  },

  onGenderTap() {
    wx.showActionSheet({
      itemList: ["女", "男", "保密"],
      success: (res) => {
        const gender = ["女", "男", "保密"][res.tapIndex];
        this.setData({ gender, genderText: gender });
        this.debouncedSave({ gender });
      },
    });
  },

  // 省市区选择
  onRegionChange(e) {
    const detail = e.detail || {};
    const code = detail.code || [];
    const value = detail.value || [];
    const country = value[0] || "中国";
    const province = value[1] || "";
    const city = value[2] || "";
    const regionText = [province, city].filter(Boolean).join(" / ");
    this.setData({
      country,
      province,
      city,
      regionText,
      regionValues: [country, province, city],
    });
    this.debouncedSave({ country, province, city });
  },

  // 详细地址
  onAddressInput(e) {
    const address = e.detail.value;
    this.setData({ address });
    this.debouncedSave({ address });
  },

  debouncedSave(changes) {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveProfile(changes);
    }, 800);
  },

  async saveProfile(changes) {
    const data = {
      name: this.data.name,
      gender: this.data.gender || "女",
      birthday: this.data.birthday,
      country: this.data.country || "中国",
      province: this.data.province,
      city: this.data.city,
      address: this.data.address,
      remark: this.data.remark,
      ...changes,
    };
    try {
      await api.updateMemberProfile(data);
    } catch (err) {
      console.warn("保存失败", err);
    }
  },
});
