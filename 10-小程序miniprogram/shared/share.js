const config = require('./runtime-config');
const HOME = '/pages/home/home';
const titles = { messages: '伊娃东方舞 · 信息', home: '伊娃东方舞线上学院', system: '伊娃东方舞 · 全部课程', offline: '伊娃东方舞 · 线下课程', events: '伊娃东方舞赛事', profile: '伊娃东方舞 · 个人中心', 'commerce-orders': '伊娃东方舞 · 课程订单', login: '伊娃东方舞 · 学员登录', admin: '伊娃东方舞', 'profile-edit': '伊娃东方舞 · 学员中心' };
function text(value) { return String(value || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(); }
function cover(item) {
  const value = item.cover_image || item.coverImage || item.coverUrl || item.cover_url || item.image || '';
  if (/^https:\/\//i.test(value) || /^\/images\//.test(value)) return value;
  if (value.startsWith('/') && !value.startsWith('//')) return config.apiBase.replace(/\/api\/mini\/?$/, '') + value;
  return '/images/logo.png';
}
function link(route, params) {
  const query = Object.keys(params || {}).filter(key => params[key] !== undefined && params[key] !== null && params[key] !== '')
    .map(key => `${key}=${encodeURIComponent(params[key])}`).join('&');
  return route + (query ? '?' + query : '');
}
function card(title, route, params, item = {}, detail = '') {
  return { title: [text(title) || '伊娃东方舞', text(detail)].filter(Boolean).join(' · ').slice(0, 90), path: link(route, params), imageUrl: cover(item) };
}
function resolveShare(page, route) {
  const d = page.data || {}, options = page.shareOptions || {};
  if (route === 'player') return card(d.course?.name || '课程学习', '/pages/player/player', { seriesId: d.seriesId || options.seriesId, videoId: d.videoId || options.videoId, courseId: d.courseId || options.courseId }, d.course, d.video?.name);
  if (route === 'detail') return card(d.series?.name || '课程详情', '/pages/detail/detail', { id: d.id || options.id }, d.series, d.series?.subtitle || d.series?.teacher);
  if (route === 'offline-detail') return card(d.course?.name || '线下课程', '/pages/offline-detail/offline-detail', { id: d.courseId || options.id }, d.course, d.course?.teacherText);
  if (['event-detail', 'event-group', 'event-register'].includes(route)) return card(d.competition?.name || '东方舞赛事', `/pages/${route}/${route}`, { id: d.id || d.competitionId || options.id, ...(route === 'event-group' ? {groupId: d.groupId || options.groupId} : {}) }, d.competition, route === 'event-group' ? d.group?.name : d.competition?.dateText);
  // Account pages share only their entry, never account fields, orders, login handoffs or tokens.
  const item = route === 'home' ? d.carouselCourses?.[0] : route === 'system' ? d.courses?.[0] : route === 'offline' ? d.visibleCourses?.[0] : route === 'events' ? d.visibleEvents?.[0] : {};
  return card(titles[route], route === 'admin' ? HOME : `/pages/${route}/${route}`, {}, item || {});
}
function withShare(route, definition) {
  const onLoad = definition.onLoad, onReady = definition.onReady;
  return Object.assign({}, definition, {
    onLoad(options = {}) { this.shareOptions = options; return onLoad && onLoad.call(this, options); },
    onReady() {
      wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage', 'shareTimeline'] });
      return onReady && onReady.call(this);
    },
    onShareAppMessage() { return resolveShare(this, route); },
    onShareTimeline() {
      const result = resolveShare(this, route);
      return { title: result.title, imageUrl: result.imageUrl, query: result.path.split('?')[1] || '' };
    }
  });
}
module.exports = { withShare, resolveShare };
