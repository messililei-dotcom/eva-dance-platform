import { unzipSync } from 'fflate';
// Formula caches may be stale or absent. Importing an absent fee as zero is unsafe.
export async function validateImportWorkbook(file: File) {
  let total = 0, entries = 0;
  const files = unzipSync(new Uint8Array(await file.arrayBuffer()), { filter: entry => {
    total += entry.originalSize; entries++;
    if (total > 30 * 1024 * 1024 || entries > 1000) throw new Error('解压后的表格过大，请删除空白格式行或拆分文件');
    return /^xl\/worksheets\/[^/]+\.xml$/.test(entry.name);
  } });
  const formulas: string[] = [];
  for (const [name, bytes] of Object.entries(files)) {
    const doc = new DOMParser().parseFromString(new TextDecoder().decode(bytes), 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('工作表 XML 损坏，请重新保存为 Excel');
    for (const cell of Array.from(doc.getElementsByTagNameNS('*', 'c'))) {
      const value = cell.getElementsByTagNameNS('*', 'v')[0]?.textContent || '';
      if ((!cell.getAttribute('t') || cell.getAttribute('t') === 'n') && /^[+-]?[\d.]+(?:[eE][+-]?\d+)?$/.test(value) && Math.abs(Number(value)) >= 1e15) throw new Error(`${name.split('/').pop()} ${cell.getAttribute('r') || ''} 的数字超过 Excel 15 位有效精度，请将号码或编码改为文本并核对原始值`);
      if (cell.getElementsByTagNameNS('*', 'f').length) formulas.push(`${name.split('/').pop()} ${cell.getAttribute('r') || ''}`);
    }
  }
  if (formulas.length) throw new Error(`发现 ${formulas.length} 个公式单元格（${formulas.slice(0, 5).join('、')}）。为避免缓存过期或金额变成 0，请复制并“粘贴为值”后上传`);
}
