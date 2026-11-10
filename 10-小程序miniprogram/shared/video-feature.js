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
          if (typeof this.onVideoFeatureDisabled === 'function') {
            this.onVideoFeatureDisabled();
          } else {
            this.videoContext.stop();
            this.setData({ playUrl: '', hasStartedPlayback: false });
          }
        }
      });
      return Promise.all([refresh, onShow ? onShow.call(this) : undefined]);
    }
  });
}

async function openPage(options, method) {
  if (!options.url.startsWith('/pages/player/player') || await enabled()) {
    return wx[method](options);
  }
  const match = options.url.match(/[?&]seriesId=([^&]+)/);
  if (match && match[1]) {
    return wx[method]({ ...options, url: '/pages/detail/detail?id=' + match[1] });
  }
  wx.showToast({ title: '视频播放暂未开放', icon: 'none' });
}

function navigateTo(options) { return openPage(options, 'navigateTo'); }
function redirectTo(options) { return openPage(options, 'redirectTo'); }

module.exports = { enabled, withVideoFeature, navigateTo, redirectTo };
