export function normalizeMemberPhone(value: unknown) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length === 13 && digits.startsWith('86')) return digits.slice(2);
  return digits;
}

export function memberOptionMatchesSearch(input: unknown, label: unknown) {
  const query = String(input ?? '').trim().toLocaleLowerCase('zh-CN');
  if (!query) return true;

  const text = String(label ?? '').toLocaleLowerCase('zh-CN');
  if (text.includes(query)) return true;

  const queryPhone = normalizeMemberPhone(query);
  return queryPhone.length >= 3 && normalizeMemberPhone(text).includes(queryPhone);
}

export function normalizedMemberPhoneSql(valueSql: string) {
  const digitsSql = `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(${valueSql}, ''), '+', ''), ' ', ''), '-', ''), '(', ''), ')', '')`;
  return `(CASE WHEN length(${digitsSql}) = 13 AND substr(${digitsSql}, 1, 2) = '86' THEN substr(${digitsSql}, 3) ELSE ${digitsSql} END)`;
}
