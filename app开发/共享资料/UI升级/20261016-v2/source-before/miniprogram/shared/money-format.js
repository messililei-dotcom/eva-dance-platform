function finiteNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function trimZeros(value) {
  return value.replace(/\.00$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
}

function formatPrice(value, symbol = "¥") {
  return `${symbol}${trimZeros(finiteNumber(value).toFixed(2))}`;
}

function formatPaymentAmount(value, symbol = "¥") {
  return `${symbol}${finiteNumber(value).toFixed(2)}`;
}

function formatCompactMoney(value, symbol = "¥") {
  const number = finiteNumber(value);
  const abs = Math.abs(number);
  if (abs >= 100000000) return `${symbol}${trimZeros((number / 100000000).toFixed(1))}亿`;
  if (abs >= 10000) return `${symbol}${trimZeros((number / 10000).toFixed(1))}万`;
  return formatPrice(number, symbol);
}

module.exports = {
  formatPrice,
  formatPaymentAmount,
  formatCompactMoney
};
