Page({
  returnToPwa() {
    if (!wx.exitMiniProgram) {
      wx.showToast({ title: "请手动返回网课", icon: "none" });
      return;
    }
    // 必须从 bindtap 直接调用，满足微信“仅在点击行为时调用”的限制。
    wx.exitMiniProgram({
      fail: () => wx.showToast({ title: "请手动返回网课", icon: "none" })
    });
  }
});
