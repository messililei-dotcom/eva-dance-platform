// Legacy imports stored numeric category codes and embedded the category in the name.
// Prefer the named category used by the current four-column import template.
export function eventGroupPresentation(group: { name: string; category: string }) {
  const name = group.name.trim();
  const category = (group.category || '').trim();
  if (category && !/^\d+$/.test(category)) {
    const prefix = `${category}/`;
    return { category, name: name.startsWith(prefix) ? name.slice(prefix.length) : name };
  }
  const parts = name.split('/').map((part) => part.trim()).filter(Boolean);
  if (parts.length > 1) return { category: parts.slice(0, -1).join('/'), name: parts.at(-1)! };
  return { category: '未分类', name };
}

export function groupEventCategories<T extends { name: string; category: string }>(groups: T[]) {
  const result = new Map<string, Array<T & { displayName: string }>>();
  groups.forEach((group) => {
    const display = eventGroupPresentation(group);
    const items = result.get(display.category) || [];
    items.push({ ...group, displayName: display.name });
    result.set(display.category, items);
  });
  return [...result].map(([name, items]) => ({ name, items }));
}

export function filterEventCategories<T extends { name: string; dance_type: string; age_range: string }>(
  categories: Array<{ name: string; items: T[] }>, selected: string | null | undefined, query: string,
) {
  const keyword = query.trim().toLocaleLowerCase('zh-CN');
  return categories.filter((category) => keyword || !selected || selected === '*' || category.name === selected)
    .map((category) => ({ ...category, items: category.items.filter((group) => !keyword ||
      [group.name, category.name, group.dance_type, group.age_range]
        .some((value) => (value || '').toLocaleLowerCase('zh-CN').includes(keyword))) }))
    .filter((category) => category.items.length);
}
