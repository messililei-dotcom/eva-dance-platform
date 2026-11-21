// Registration contact matching only; never use this to merge members or grant course access.
export function registrationPhoneKey(value: unknown): string {
  const raw = String(value ?? '').trim().replace(/[\s()\-]/g, '').replace(/^00/, '+');
  if (/^\+?861[3-9]\d{9}$/.test(raw)) return raw.replace(/^\+?86/, '');
  return raw;
}

export function registrationPhoneAliases(memberPhone: unknown): string[] {
  const key = registrationPhoneKey(memberPhone);
  if (!/^\+?\d{4,15}$/.test(key)) return [];
  const aliases = new Set([key]);
  // Malaysia uses a domestic trunk zero, omitted after +60. Do not guess a
  // country from a bare local number or match arbitrary national suffixes.
  const malaysia = key.match(/^\+?60(1\d{8,9})$/);
  if (malaysia) {
    aliases.add('+60' + malaysia[1]);
    aliases.add('60' + malaysia[1]);
    aliases.add('0' + malaysia[1]);
  }
  return [...aliases];
}

export function sameRegistrationPhone(value: unknown, memberPhone: unknown): boolean {
  return registrationPhoneAliases(memberPhone).includes(registrationPhoneKey(value));
}

// Only pass a static, trusted column expression here, never request data.
export function registrationPhoneSql(column: string): string {
  const raw = `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(${column}, ''), ' ', ''), '-', ''), '(', ''), ')', ''), char(9), '')`;
  const international = `(CASE WHEN substr(${raw},1,2)='00' THEN '+' || substr(${raw},3) ELSE ${raw} END)`;
  return `(CASE WHEN length(${international})=14 AND substr(${international},1,3)='+86' THEN substr(${international},4) WHEN length(${international})=13 AND substr(${international},1,2)='86' THEN substr(${international},3) ELSE ${international} END)`;
}
