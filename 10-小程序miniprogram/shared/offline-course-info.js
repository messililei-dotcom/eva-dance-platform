const official = require('./official-offline-content');

function normalizeKey(value) {
  return String(value || '').replace(/\([^)]*\)|（[^）]*）/g, '')
    .replace(/第[一二三四五六七八九十百\d]+[届期级]/g, '')
    .replace(/[^\u4e00-\u9fa5a-z0-9]/gi, '').toLowerCase();
}

function offlineIntroduction(period) {
  const key = period.group_key || normalizeKey(period.name);
  const matched = official.courses[official.aliases[key]]
    || Object.values(official.courses).find(course => normalizeKey(course.title) === normalizeKey(period.name));
  const content = official.periodOverrides[String(period.source_id)] || matched;
  const description = content && content.fullDescription || period.description || period.subtitle || '课程介绍正在完善中，具体安排请联系课程顾问。';
  return {
    // Introductory copy may contain last year's schedule; live period dates win.
    descriptionText: description.replace(/开课时间：[^｜\n]+/g, '开课时间：以所选期次安排为准'),
    outline: content && content.outline.length ? content.outline : period.outline || [],
    levelText: content && content.level || period.level || ''
  };
}

function periodPurchase(period, now = Date.now()) {
  const today = new Date(Number(now) + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
  if (!['active', 'planned'].includes(period.period_status)) return { canPurchase: false, purchaseReason: '本期暂未开放购买' };
  if (period.end_date && String(period.end_date).slice(0, 10) < today) return { canPurchase: false, purchaseReason: '本期已结束' };
  if (Number(period.capacity) > 0 && Number(period.remaining) <= 0) return { canPurchase: false, purchaseReason: '本期名额已满' };
  if (!(Number(period.price) > 0)) return { canPurchase: false, purchaseReason: '请联系课程顾问咨询价格' };
  if (!/^\d+$/.test(String(period.source_id || '')) || Number(period.source_id) <= 0) return { canPurchase: false, purchaseReason: '期次信息待完善' };
  return { canPurchase: true, purchaseReason: '' };
}

module.exports = { offlineIntroduction, periodPurchase };
