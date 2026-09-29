// Only known in-app destinations are opened; message bodies and unknown URLs stay in the inbox.
function messageTarget(message) {
  const url = String(message && message.actionUrl || '');
  const course = url.match(/^\/courses\/(\d+)(?:\/videos)?(?:[?#].*)?$/);
  if (course) return { url: `/pages/player/player?seriesId=${course[1]}` };
  const offline = url.match(/^\/offline\/(\d+)(?:[?#].*)?$/);
  if (offline) return { url: `/pages/offline-detail/offline-detail?id=${900000 + Number(offline[1])}` };
  if (url === '/dashboard/profile#offline-courses') return { url: '/pages/offline/offline', tab: true };
  if (/^\/dashboard\/(?:profile|progress|certificates)(?:[?#].*)?$/.test(url)) return { url: '/pages/profile/profile', tab: true };
  return null;
}
module.exports = { messageTarget };
