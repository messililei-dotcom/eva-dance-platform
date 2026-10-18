const api = require('../utils/api');

let pendingFeatures = null;
function enabled() {
  if (pendingFeatures) return pendingFeatures;
  pendingFeatures = Promise.resolve().then(() => api.getFeatures())
    .then(result => !!result && result.videoPlaybackEnabled === true, () => false)
    .finally(() => { pendingFeatures = null; });
  return pendingFeatures;
}

// Refresh on every visible page; never persist a previous enabled value.
function withVideoFeature(definition) {
  const onShow = definition.onShow;
  return Object.assign({}, definition, {
    data: Object.assign({}, definition.data, { videoPlaybackEnabled: false }),
    async onShow() {
      if (!this.videoContext) this.setData({ videoPlaybackEnabled: false });
      const refresh = enabled().then(active => {
        this.setData({ videoPlaybackEnabled: active });
        if (!active && this.videoContext) {
          this.videoContext.stop();
          this.setData({ playUrl: '', hasStartedPlayback: false });
        }
      });
      return Promise.all([refresh, onShow ? onShow.call(this) : undefined]);
    }
  });
}

async function navigateTo(options) {
  if (!options.url.startsWith('/pages/player/player')) return wx.navigateTo(options);
  if (await enabled()) return wx.navigateTo(options);
  const match = options.url.match(/[?&]seriesId=([^&]+)/);
  if (match && match[1]) return wx.navigateTo({ url: '/pages/detail/detail?id=' + match[1] });
  wx.showToast({ title: '视频播放暂未开放', icon: 'none' });
}

module.exports = { enabled, withVideoFeature, navigateTo };
