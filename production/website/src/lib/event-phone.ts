export const PHONE_COUNTRIES = [
  { code: '+86', flag: '🇨🇳', name: '中国大陆' }, { code: '+852', flag: '🇭🇰', name: '中国香港' },
  { code: '+853', flag: '🇲🇴', name: '中国澳门' }, { code: '+886', flag: '🇹🇼', name: '中国台湾' },
  { code: '+20', flag: '🇪🇬', name: '埃及' }, { code: '+1', flag: '🇺🇸', name: '美国/加拿大' },
  { code: '+44', flag: '🇬🇧', name: '英国' }, { code: '+61', flag: '🇦🇺', name: '澳大利亚' },
  { code: '+65', flag: '🇸🇬', name: '新加坡' }, { code: '+60', flag: '🇲🇾', name: '马来西亚' },
  { code: '+81', flag: '🇯🇵', name: '日本' }, { code: '+82', flag: '🇰🇷', name: '韩国' },
  { code: '+66', flag: '🇹🇭', name: '泰国' }, { code: '+33', flag: '🇫🇷', name: '法国' },
  { code: '+49', flag: '🇩🇪', name: '德国' }, { code: '+7', flag: '🇷🇺', name: '俄罗斯' },
  { code: '+971', flag: '🇦🇪', name: '阿联酋' }, { code: '+91', flag: '🇮🇳', name: '印度' },
];
export function normalizeEventPhone(value: unknown, countryValue: unknown = '+86') {
  const raw = String(value ?? '').trim().replace(/[\s()\-]/g, '');
  let code = String(countryValue || '+86').trim();
  if (!code.startsWith('+')) code = '+' + code;
  if (!/^\+[1-9]\d{0,2}$/.test(code)) throw new Error('请填写正确的国家/地区区号');
  let digits = raw.replace(/^00/, '+');
  if (/^852\d{8}$/.test(digits) || /^853\d{8}$/.test(digits)) digits = '+' + digits;
  if (digits.startsWith('+')) {
    if (!/^\+[1-9]\d{7,14}$/.test(digits)) throw new Error('请填写正确的国际手机号');
    const known = PHONE_COUNTRIES.map(item => item.code).sort((a,b) => b.length-a.length).find(item => digits.startsWith(item));
    if (known) code = known;
    if (!digits.startsWith(code)) throw new Error('请填写号码对应的国家/地区区号');
    digits = digits.slice(code.length);
  } else if (code !== '+86' && digits.startsWith(code.slice(1))) {
    const localLength = code === '+852' || code === '+853' || code === '+65' ? 8 : code === '+1' ? 10 : 0;
    if (localLength && digits.length === localLength + code.length - 1) digits = digits.slice(code.length - 1);
  }
  if (!/^\d+$/.test(digits)) throw new Error('手机号只能包含数字及开头的国际区号');
  // Malaysia's domestic trunk prefix is not part of the international number.
  // Accept local, E.164 and country-prefixed input through the same login key.
  if (code === '+60') {
    if (/^601\d{8,9}$/.test(digits)) digits = digits.slice(2);
    digits = digits.replace(/^0/, '');
    if (!/^1\d{8,9}$/.test(digits)) throw new Error('请填写正确的马来西亚手机号');
  }
  if (code === '+86' && digits.length === 13 && digits.startsWith('86')) digits = digits.slice(2);
  if (code === '+86' && !/^1[3-9]\d{9}$/.test(digits)) throw new Error('请填写正确的中国大陆手机号，其他地区请选择相应区号');
  if (['+852','+853','+65'].includes(code) && digits.length !== 8) throw new Error('该地区手机号应为8位本地号码');
  if (code === '+1' && digits.length !== 10) throw new Error('该地区手机号应为10位本地号码');
  if (code !== '+86' && (digits.length < 4 || code.length - 1 + digits.length > 15)) throw new Error('请填写正确的国际手机号');
  return { phone: code === '+86' ? digits : code + digits, internationalPhone: code + digits, countryCode: code, nationalNumber: digits };
}
