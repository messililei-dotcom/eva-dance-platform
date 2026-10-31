// Filter only the server-normalized public catalogue; unlocked is populated from private rights.
function keyword(value) { return String(value || '').trim().toLocaleLowerCase().replace(/\s+/g, ''); }
function categories(rows) { return ['全部', ...new Set(rows.map(row => String(row.category || '').trim()).filter(Boolean))]; }
function filterCatalog(rows, options = {}) {
  const q = keyword(options.keyword);
  return rows.filter(row => (!options.unlockedOnly || row.unlocked === true)
    && (!options.category || options.category === '全部' || row.category === options.category)
    && (!q || keyword([row.title, row.name, row.meta, row.subtitle, row.teacher, row.category, row.description].filter(Boolean).join(' ')).includes(q)));
}
module.exports = { filterCatalog, categories };
