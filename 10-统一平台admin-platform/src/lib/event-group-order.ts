/** Move within the complete event order, including groups outside the current page. */
export function moveGroupToPosition<T extends { id: number; sortOrder?: number }>(rows: T[], id: number, position: number): T[] {
  if (!Number.isSafeInteger(position) || position < 1 || position > rows.length) throw new Error('序号超出组别范围');
  const index = rows.findIndex(row => Number(row.id) === id);
  if (index < 0) throw new Error('组别不存在');
  if (index === position - 1) return rows;
  const ordered = [...rows];
  const [row] = ordered.splice(index, 1);
  ordered.splice(position - 1, 0, row);
  return ordered.map((item, i) => ({ ...item, sortOrder: i + 1 }));
}
