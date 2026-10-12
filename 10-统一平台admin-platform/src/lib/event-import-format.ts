export type ImportKind = 'groups' | 'players' | 'judges';
export type ImportIssue = { row: number; message: string };
const columns: Record<ImportKind, string[]> = {
  groups: ['序号', '组别名称', '报名费', '编码', '年龄段', '舞种', '参赛形式', '人数上限', '评分规则ID', '状态'],
  players: ['组别名称', '选手姓名', '手机号', '领队机构', '领队老师', '节目名称'],
  judges: ['序号', '组别名称', '评委姓名', '手机号', '所属机构', '职称'],
};
const aliases: Record<string, string> = { 组别: '组别名称', 排序: '序号', 手机号码: '手机号', 参赛曲目: '节目名称' };
export const requiredImportColumns: Record<ImportKind, string[]> = { groups: ['组别名称'], players: ['组别名称', '选手姓名', '手机号'], judges: ['组别名称', '评委姓名', '手机号'] };
export function importText(value: unknown) {
  if (value instanceof Date) throw new Error('被 Excel 识别为日期，请将此列设为文本并重新填写');
  if (typeof value === 'boolean') throw new Error('不能填写布尔值');
  const raw = String(value ?? '').trim();
  if (/^#(?:REF!|DIV\/0!|VALUE!|N\/A|NAME\?|NUM!|NULL!|SPILL!|CALC!|GETTING_DATA)$/.test(raw) || raw.startsWith('=')) throw new Error('公式或公式错误，请粘贴为值后上传');
  return String(value ?? '').replace(/^\uFEFF/, '').replace(/[\u200B-\u200D]/g, '').trim();
}
const normalized = (value: unknown) => importText(value).normalize('NFKC').replace(/\u00a0/g, ' ');
export function decimalText(value: unknown, money = false) {
  if (typeof value === 'number' && (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value)))) throw new Error('数字超出安全精度，请使用文本格式');
  let text = normalized(value);
  if (money) text = text.replace(/^(?:人民币|RMB|CNY|[¥￥])\s*/i, '').replace(/\s*元$/, '');
  if (!text) return '';
  if (text.includes(',')) {
    if (!/^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(text)) throw new Error('千位分隔格式不正确，请使用 1,000.00 或 1000.00');
    text = text.replace(/,/g, '');
  }
  const match = /^([+-]?)(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(text);
  if (!match) throw new Error('不是有效数字（不支持百分比、日期、公式错误或单位文字）');
  const exponent = Number(match[4] || 0);
  if (Math.abs(exponent) > 20 || text.length > 60) throw new Error('数字超出允许范围');
  const digits = match[2] + (match[3] || '');
  const point = match[2].length + exponent;
  let integer = point <= 0 ? '0' : point >= digits.length ? digits + '0'.repeat(point - digits.length) : digits.slice(0, point);
  let fraction = point <= 0 ? '0'.repeat(-point) + digits : point < digits.length ? digits.slice(point) : '';
  integer = integer.replace(/^0+(?=\d)/, ''); fraction = fraction.replace(/0+$/, '');
  return (match[1] === '-' && (integer !== '0' || fraction) ? '-' : '') + integer + (fraction ? '.' + fraction : '');
}
export function importNumber(value: unknown, money = false, fallback = 0) {
  const text = decimalText(value, money);
  if (!text) return fallback;
  const number = Number(text);
  if (number < 0 || !Number.isFinite(number)) throw new Error('不能为负数或超出允许范围');
  if (money) {
    if ((text.split('.')[1] || '').length > 2) throw new Error('金额最多保留两位小数，请明确修改金额');
    if (number > 100000000) throw new Error('金额不能超过 100000000 元');
    return Math.round(number * 100) / 100;
  }
  if (!Number.isSafeInteger(number)) throw new Error('必须为非负整数，不能是小数或超出安全精度');
  return number;
}
export function importPhone(value: unknown) {
  let text = normalized(value);
  if (/^[+-]?\d+(?:\.\d+)?[eE][+-]?\d+$/.test(text) || /^\d+\.0+$/.test(text) || typeof value === 'number') text = decimalText(value);
  if (!/^[+\d][\d\s()+-]*$/.test(text)) throw new Error('手机号应为完整号码，不支持文字、小数或公式错误');
  let digits = text.replace(/[\s()+-]/g, '');
  if (digits.length === 13 && digits.startsWith('86')) digits = digits.slice(2);
  if (!/^\d{6,20}$/.test(digits)) throw new Error('手机号应为 6～20 位完整号码，请核对科学计数法是否丢失精度');
  return digits;
}
export function normalizeImportField(column: string, value: unknown): unknown {
  if (column === '报名费') return importNumber(value, true);
  if (['序号', '人数上限', '评分规则ID'].includes(column)) return importText(value) === '' ? '' : importNumber(value);
  if (column === '手机号') return importPhone(value);
  // Templates have no date columns. Never turn dates into timestamps or fees.
  return importText(value);
}
export function normalizeImportRecord(item: Record<string, unknown>, kind: ImportKind) {
  const result: Record<string, unknown> = {};
  for (const [rawKey, value] of Object.entries(item)) {
    const key = aliases[rawKey] || rawKey;
    if (columns[kind].includes(key)) result[key] = normalizeImportField(key, value);
  }
  for (const key of requiredImportColumns[kind]) if (!String(result[key] ?? '').trim()) throw new Error(`${key}不能为空`);
  return result;
}
export function hasImportHeader(raw: unknown[][], kind: ImportKind) {
  return raw.slice(0, 20).some(row => requiredImportColumns[kind].every(key => row.some(cell => aliases[String(cell ?? '').trim()] === key || String(cell ?? '').replace(/^\uFEFF/, '').trim() === key)));
}
export function parseImportRows(raw: unknown[][], kind: ImportKind) {
  const headerIndex = raw.slice(0, 20).findIndex(row => requiredImportColumns[kind].every(key => row.some(cell => aliases[String(cell ?? '').trim()] === key || String(cell ?? '').replace(/^\uFEFF/, '').trim() === key)));
  if (headerIndex < 0) throw new Error(`前 20 行未找到表头，必需列：${requiredImportColumns[kind].join('、')}。请下载模板填写`);
  const headers = raw[headerIndex].map(cell => { const key = normalized(cell); return aliases[key] || key; });
  const nonempty = headers.filter(Boolean);
  if (new Set(nonempty).size !== nonempty.length) throw new Error('表头有重复列（包括同义列），请删除重复列');
  const unknown = nonempty.filter(key => !columns[kind].includes(key) && !(kind === 'players' && ['节目编号', '选手编号'].includes(key)));
  const errors: ImportIssue[] = [], rows: Record<string, unknown>[] = [];
  raw.slice(headerIndex + 1).forEach((cells, index) => {
    if (!cells.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '')) return;
    const sourceRow = headerIndex + index + 2;
    const result: Record<string, unknown> = { __sourceRow: sourceRow };
    headers.forEach((key, column) => {
      if (!key || !columns[kind].includes(key)) return;
      try { result[key] = normalizeImportField(key, cells[column] ?? ''); }
      catch (e: any) { result[key] = cells[column] instanceof Date ? (cells[column] as Date).toISOString().slice(0,10) : String(cells[column] ?? ''); errors.push({ row: sourceRow, message: `${key}：${e.message}` }); }
    });
    requiredImportColumns[kind].forEach(key => { if (!String(result[key] ?? '').trim()) errors.push({ row: sourceRow, message: `${key}不能为空` }); });
    if (cells.some((cell, column) => !headers[column] && cell !== null && cell !== undefined && String(cell).trim() !== '')) errors.push({ row: sourceRow, message: '有数据列没有表头，请补充表头或删除该列' });
    rows.push(result);
  });
  if (!rows.length) throw new Error('文件只有表头，没有可导入的数据。请填写并保存 Excel；使用 Numbers 时请重新导出为 Excel 后上传');
  if (rows.length > 2000) throw new Error('每次最多导入 2000 行，请拆分文件');
  const scientificPhones = raw.slice(headerIndex + 1).some(cells => headers.some((key, index) => key === '手机号' && /[eE]/.test(String(cells[index] ?? ''))));
  const warnings = unknown.length ? [`以下列不在当前导入模板中，将不导入：${unknown.join('、')}。日期列请勿当作报名费或序号使用。`] : [];
  if (scientificPhones) warnings.push('手机号中的科学计数法已展开，请对照完整原始号码核对；若 Excel 之前已舍入，系统无法恢复丢失的数字。');
  return { rows, errors, warnings };
}
export function parseImportCsv(text: string) {
  const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1];
    if (ch === '"' && quoted && next === '"') { cell += '"'; i++; }
    else if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((ch === '\n' || ch === '\r') && !quoted) { if (ch === '\r' && next === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (quoted) throw new Error('CSV 引号未闭合，请重新导出 UTF-8 CSV 文件');
  row.push(cell); rows.push(row); return rows;
}
export function importSourceRow(item: Record<string, unknown>, fallback: number) {
  const row = Number(item?.__sourceRow); return Number.isSafeInteger(row) && row > 0 ? row : fallback;
}

// Export the same supported columns as import. Quote every cell and protect
// spreadsheet formula prefixes without changing numbers or phone identifiers.
export function eventImportCsv(kind: ImportKind, rows: Record<string, unknown>[], includeEntryNumbers = false) {
  const headers = kind === 'groups' ? ['序号', '组别名称', '报名费'] : kind === 'judges' ? ['序号', '组别名称', '评委姓名', '手机号', '所属机构'] : includeEntryNumbers ? ['节目编号', '选手编号', ...columns.players] : columns.players;
  const cell = (value: unknown) => {
    let text = String(value ?? '');
    if (/^[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  return '\uFEFF' + [headers, ...rows.map(row => headers.map(key => row[key] ?? ''))].map(row => row.map(cell).join(',')).join('\r\n');
}
