export type CurrencySymbol = '¥' | '$';

function finiteNumber(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function trimZeros(value: string) {
  return value.replace(/\.00$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
}

export function formatPrice(value: unknown, symbol: CurrencySymbol = '¥') {
  return `${symbol}${trimZeros(finiteNumber(value).toFixed(2))}`;
}

export function formatPaymentAmount(value: unknown, symbol: CurrencySymbol = '¥') {
  return `${symbol}${finiteNumber(value).toFixed(2)}`;
}

export function formatCompactMoney(value: unknown, symbol: CurrencySymbol = '¥') {
  const number = finiteNumber(value);
  const abs = Math.abs(number);
  if (abs >= 100000000) return `${symbol}${trimZeros((number / 100000000).toFixed(1))}亿`;
  if (abs >= 10000) return `${symbol}${trimZeros((number / 10000).toFixed(1))}万`;
  return formatPrice(number, symbol);
}

export function formatLocalizedMoney(value: unknown, symbol: CurrencySymbol = '¥', locale = 'en-US') {
  return `${symbol}${finiteNumber(value).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const digits = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
const units = ['', '拾', '佰', '仟'];
const groups = ['', '万', '亿', '兆'];

function integerToChinese(value: number) {
  if (value === 0) return digits[0];
  const parts: string[] = [];
  let groupIndex = 0;
  let rest = value;
  let needZero = false;

  while (rest > 0) {
    const groupValue = rest % 10000;
    if (groupValue === 0) {
      needZero = parts.length > 0;
    } else {
      let groupText = '';
      let zeroInside = false;
      for (let i = 0; i < 4; i += 1) {
        const digit = Math.floor(groupValue / Math.pow(10, i)) % 10;
        if (digit === 0) {
          if (groupText) zeroInside = true;
        } else {
          groupText = `${digits[digit]}${units[i]}${zeroInside ? digits[0] : ''}${groupText}`;
          zeroInside = false;
        }
      }
      parts.unshift(`${needZero ? digits[0] : ''}${groupText}${groups[groupIndex]}`);
      needZero = groupValue < 1000;
    }
    rest = Math.floor(rest / 10000);
    groupIndex += 1;
  }

  return parts.join('').replace(/零+/g, '零').replace(/零$/g, '');
}

export function formatRmbUppercase(value: unknown) {
  const cents = Math.round(Math.abs(finiteNumber(value)) * 100);
  const yuan = Math.floor(cents / 100);
  const jiao = Math.floor((cents % 100) / 10);
  const fen = cents % 10;
  const sign = finiteNumber(value) < 0 ? '负' : '';
  let text = `${sign}人民币${integerToChinese(yuan)}元`;
  if (jiao === 0 && fen === 0) return `${text}整`;
  if (jiao > 0) text += `${digits[jiao]}角`;
  if (jiao === 0 && fen > 0) text += '零';
  if (fen > 0) text += `${digits[fen]}分`;
  return text;
}

export function formatVoucherMoney(value: unknown) {
  return `${formatPaymentAmount(value)}（${formatRmbUppercase(value)}）`;
}
