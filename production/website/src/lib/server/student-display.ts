// Both channels use the same ordered catalog so the configured display base agrees.
export function studentDisplayBases(db: any): Map<number, number> {
  const rows = db.prepare('SELECT id, name FROM CourseSeries ORDER BY id').all();
  const used = new Set<number>();
  const result = new Map<number, number>();
  for (const row of rows) {
    const seed = `${row.id}|${row.name || ''}`;
    let hash = 2166136261;
    for (let i = 0; i < seed.length; i++) { hash ^= seed.charCodeAt(i); hash = Math.imul(hash, 16777619) >>> 0; }
    let base = 500 + hash % 501;
    for (let i = 0; i < 501 && used.has(base); i++) base = base === 1000 ? 500 : base + 1;
    used.add(base); result.set(Number(row.id), base);
  }
  return result;
}
