import { normalizeEventPhone } from '@/lib/event-phone';

export function samePhoneIdentity(value: unknown, expected: string, countryCode: unknown = '+86') {
  const raw = String(value ?? '').trim().replace(/[\s()\-]/g, '').replace(/^00/, '+');
  if (raw === expected) return true;
  try {
    return normalizeEventPhone(raw, countryCode).phone === expected;
  } catch {
    return false;
  }
}

export function findPhoneMembers(db: any, phone: string) {
  let normalized = { phone, nationalNumber: phone.replace(/\D/g, '') };
  try { normalized = normalizeEventPhone(phone); } catch { /* A canonical number may use a country code outside the quick-select list. */ }
  const columns = new Set(db.prepare('PRAGMA main.table_info(Member)').all().map((row: any) => row.name));
  const digitsSql = (column: string) => {
    const digits = `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(${column}, ''), '+', ''), ' ', ''), '-', ''), '(', ''), ')', '')`;
    return `(CASE WHEN length(${digits})=13 AND substr(${digits},1,2)='86' THEN substr(${digits},3) ELSE ${digits} END)`;
  };
  const digits = normalized.phone.replace(/\D/g, '');
  const nationalMatch = columns.has('phone_national_number') ? ` OR ${digitsSql('phone_national_number')} IN (?, ?)` : '';
  const values = nationalMatch ? [digits, digits, normalized.nationalNumber] : [digits];
  const rows = db.prepare(`SELECT * FROM main.Member WHERE (${digitsSql('phone')}=?${nationalMatch}) AND COALESCE(status,'active')!='deleted' ORDER BY id`).all(...values);
  return rows.filter((row: any) => samePhoneIdentity(row.phone || row.phone_national_number, normalized.phone, row.phone_country_code || '+86'));
}
