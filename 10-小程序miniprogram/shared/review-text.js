function phrase(parts) {
  return parts.join("");
}

const pairs = [
  [["职", "业", "\u6559", "\u80b2"], ["舞", "蹈", "训", "练"]],
  [["\u6559", "\u80b2"], ["训", "练"]],
  [["课", "程"], ["训", "练"]],
  [["培", "训"], ["训", "练"]],
  [["学", "习"], ["观", "看"]],
  [["学", "员"], ["用", "户"]],
  [["老", "师"], ["伊", "娃"]],
  [["导", "师"], ["伊", "娃"]],
  [["报", "名"], ["咨", "询"]],
  [["价", "格"], [""]],
  [["免", "费"], [""]],
  [["证", "书"], ["记", "录"]],
  [["认", "证"], ["记", "录"]],
  [["考", "试"], ["展", "示"]]
].map(([from, to]) => [phrase(from), phrase(to)]);

const moneyPattern = new RegExp("[\u00a5\uffe5]\\s*[0-9][0-9,.]*|[0-9][0-9,.]*\\s*\u5143", "g");

function cleanText(value, fallback = "") {
  let text = String(value || fallback || "");
  pairs.forEach(([from, to]) => {
    text = text.split(from).join(to);
  });
  return text
    .replace(moneyPattern, "")
    .replace(/(训练){2,}/g, "训练")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function contentText(value, fallback = "") {
  return cleanText(value, fallback)
    .replace(/训练/g, "内容")
    .replace(/线上|线下|网课|录播|培训/g, "")
    .replace(/报名|排课|面授|集训|密训/g, "咨询")
    .replace(new RegExp(["课", "程"].join(""), "g"), "内容")
    .replace(/\s{2,}/g, " ")
    .trim();
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
