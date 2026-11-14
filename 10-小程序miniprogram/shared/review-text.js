const displayTerms = [
  ["线上学院", "视频专区"],
  ["线下课程", "线下活动"],
  ["线上课程", "视频内容"],
  ["线上课", "视频内容"],
  ["线下课", "线下活动"],
  ["课程目录", "内容目录"],
  ["课节目录", "分节目录"],
  ["课节", "分节"],
  ["课程顾问", "服务顾问"],
  ["课程学习", "内容浏览"],
  ["课程证书", "活动证书"],
  ["课程", "内容"],
  ["课时", "次数"],
  ["课次", "次"],
  ["开课中", "进行中"],
  ["待开课", "待开始"],
  ["已结课", "已结束"],
  ["上课地点", "活动地点"],
  ["开课时间", "开始时间"],
  ["上课时间", "活动时间"],
  ["到课", "到场"],
  ["课堂", "现场"],
  ["授课", "分享"],
  ["听课", "观看"],
  ["网课", "在线视频"],
  ["培训", "交流"],
  ["教育", "文化"],
  ["课", "内容"]
];

function cleanText(value, fallback = "") {
  let text = String(value || fallback || "").trim();
  displayTerms.forEach(([term, replacement]) => {
    text = text.split(term).join(replacement);
  });
  return text;
}

function contentText(value, fallback = "") {
  return cleanText(value, fallback);
}

function cleanItem(item, fields) {
  const next = { ...(item || {}) };
  fields.forEach(field => {
    if (field in next) next[field] = cleanText(next[field]);
  });
  return next;
}

module.exports = {
  cleanItem,
  cleanText,
  contentText
};
