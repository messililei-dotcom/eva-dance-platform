function pendingMusicKey(memberId, registrationId) {
  return `eva-event-music:${memberId}:${registrationId}`;
}

module.exports = { pendingMusicKey };
