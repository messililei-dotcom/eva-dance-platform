import { normalizeEventPhone } from './event-phone';

export function formatMemberPhoneForDisplay(value: unknown, countryCode: unknown = '') {
  const original = String(value ?? '').trim();
  const compact = original.replace(/[\s()-]/g, '').replace(/^00(?=[1-9])/, '+');
  const legacyMalaysia = /^600?1\d{8,9}$/.test(compact);
  const legacyHongKongOrMacao = /^85[23]\d{8}$/.test(compact);
  const international = legacyMalaysia || legacyHongKongOrMacao ? `+${compact}` : compact;
  try {
    const normalized = normalizeEventPhone(international, legacyMalaysia ? '+60' : countryCode);
    return normalized.countryCode + normalized.nationalNumber;
  } catch {
    // Keep explicitly international numbers from regions outside the quick-select list.
    return /^\+[1-9]\d{7,14}$/.test(international) ? international : original;
  }
}
