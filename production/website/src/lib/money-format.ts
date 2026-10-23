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
