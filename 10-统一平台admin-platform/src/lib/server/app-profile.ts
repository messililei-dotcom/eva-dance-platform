import { AppError } from './app-session';

/** Merge only editable App fields into the server-owned member record. */
export function mergeAppProfile(existing: Record<string, unknown>, draft: Record<string, unknown>) {
  const merged = {...existing};
  for (const key of ['name', 'gender', 'birthday', 'country', 'province', 'city', 'address']) {
    if (draft[key] === undefined) continue;
    const value = draft[key];
    if (typeof value !== 'string' || value.trim().length > (key === 'name' ? 60 : 300)) throw new AppError('个人资料格式无效');
    merged[key] = value.trim();
  }
  if (typeof merged.name !== 'string' || !merged.name.trim()) throw new AppError('姓名不能为空');
  // Validate newly submitted dates while preserving historical values on partial edits.
  if (draft.birthday !== undefined && merged.birthday !== '') {
    const birthday = String(merged.birthday);
    const date = new Date(`${birthday}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== birthday || birthday > new Date().toISOString().slice(0, 10)) throw new AppError('请填写有效生日');
  }
  return merged;
}
