// Unknown or mixed age ranges remain visible under 全部; never guess an age category.
function eventAgeGroup(name, ageRange, category) {
  const text = [name, ageRange, category].filter(Boolean).join(' ').toLowerCase();
  if (/青少年|少年|\bteen(?:ager)?s?\b|\byouth\b/.test(text)) return '青少年';
  if (/少儿|幼儿|儿童|\bchildren\b|\bchild\b|\bkids?\b/.test(text)) return '少儿';
  if (/成人|成年|\badults?\b/.test(text)) return '成人';
  const age = String(ageRange || '').trim();
  const range = age.match(/^(\d{1,2})\s*(?:岁\s*)?[-—–~～至]\s*(\d{1,2})\s*岁?$/);
  if (range) {
    const low = Number(range[1]), high = Number(range[2]);
    if (high < low) return '';
    if (low >= 18) return '成人';
    if (low >= 12 && high < 18) return '青少年';
    if (high < 12) return '少儿';
  }
  const over = age.match(/^(\d{1,2})\s*(?:岁及以上|岁以上|\+)$/);
  if (over && Number(over[1]) >= 18) return '成人';
  return '';
}
module.exports = { eventAgeGroup };
