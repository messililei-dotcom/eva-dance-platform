// Ownership comes only from the authenticated, non-cached server response.
async function authorizedCourseIds(api) {
  if (typeof wx === 'undefined' || typeof wx.getStorageSync !== 'function' || !wx.getStorageSync('token')) return new Set();
  const member = wx.getStorageSync('memberId');
  const rows = await api.getAuthorizedSeries();
  if (!wx.getStorageSync('token') || wx.getStorageSync('memberId') !== member) throw new Error('账号已切换，请刷新课程');
  return new Set((rows || []).map(row => String(row.series_id || row.id)));
}
module.exports = { authorizedCourseIds };
