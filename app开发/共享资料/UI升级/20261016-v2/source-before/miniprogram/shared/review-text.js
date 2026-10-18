function cleanText(value, fallback = "") {
  return String(value || fallback || "").trim();
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
