(function(root, factory) {
  const catalog = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = catalog;
  if (root) root.EVAOfflineCatalog = catalog;
})(typeof globalThis !== "undefined" ? globalThis : this, function() {
  function cleanText(value) {
    return String(value || "").trim();
  }

  function cleanDate(value) {
    return cleanText(value).slice(0, 10);
  }

  function courseKey(item) {
    return cleanText(item && (item.group_key || item.name)).replace(/\s+/g, " ").toLowerCase();
  }

  function periodYear(item) {
    const text = [item && item.start_date, item && item.end_date, item && item.subtitle]
      .filter(Boolean)
      .join(" ");
    const years = text.match(/20\d{2}/g) || [];
    return years.length ? Math.max.apply(null, years.map(Number)) : 0;
  }

  function comparePeriods(left, right) {
    const yearDiff = periodYear(right) - periodYear(left);
    if (yearDiff) return yearDiff;
    const dateDiff = cleanDate(right && (right.start_date || right.end_date))
      .localeCompare(cleanDate(left && (left.start_date || left.end_date)));
    if (dateDiff) return dateDiff;
    return Number(right && right.id || 0) - Number(left && left.id || 0);
  }

  function periodLabel(item) {
    const start = cleanDate(item && item.start_date);
    const end = cleanDate(item && item.end_date);
    if (start) return start + (end && end !== start ? ` 至 ${end}` : "");
    const subtitle = cleanText(item && item.subtitle);
    return subtitle && subtitle.toLowerCase() !== "offline" ? subtitle : "期次待公布";
  }

  function groupOfflineCourses(rows) {
    const groups = new Map();
    (rows || []).forEach(item => {
      const key = courseKey(item);
      if (!key) return;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });

    return Array.from(groups.values()).map(items => {
      const periods = items.slice().sort(comparePeriods).map(item => ({
        ...item,
        periodLabel: periodLabel(item),
        sessionsText: `${Number(item.total_courses || 0)} 课次`
      }));
      const representative = periods[0];
      const prices = periods.map(item => Number(item.price || 0)).filter(price => price > 0);
      return {
        ...representative,
        id: representative.id,
        name: cleanText(representative.name) || "线下课程",
        cover_image: representative.cover_image || (periods.find(item => item.cover_image) || {}).cover_image || "",
        studentCount: Math.max.apply(null, periods.map(item => Number(item.group_total_students ?? item.total_students ?? 0))),
        periods,
        periodCount: periods.length,
        periodText: `${periods.length} 个期次`,
        latestPeriodText: periodLabel(representative),
        minPrice: prices.length ? Math.min.apply(null, prices) : 0,
        maxPrice: prices.length ? Math.max.apply(null, prices) : 0,
        searchText: periods.map(item => [
          item.name,
          item.subtitle,
          item.teacher,
          item.category,
          item.start_date,
          item.end_date
        ].filter(Boolean).join(" ")).join(" ")
      };
    });
  }

  function findOfflineCourseGroup(rows, id) {
    const source = (rows || []).find(item => String(item.id) === String(id));
    if (!source) return null;
    return groupOfflineCourses(rows).find(group => courseKey(group) === courseKey(source)) || null;
  }

  return {
    cleanDate,
    courseKey,
    comparePeriods,
    periodLabel,
    groupOfflineCourses,
    findOfflineCourseGroup
  };
});
