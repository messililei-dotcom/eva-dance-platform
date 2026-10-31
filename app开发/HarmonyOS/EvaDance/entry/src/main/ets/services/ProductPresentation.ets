import { Row } from './Models';

export function productPrice(row: Row): string {
  const amount = row.priceFen;
  if (amount === undefined || !Number.isSafeInteger(amount) || amount < 0) return '价格待确认';
  return '¥' + (amount / 100).toFixed(2);
}

export function productStock(row: Row): string {
  const stock = row.stock;
  if (stock === undefined || !Number.isSafeInteger(stock) || stock < 0) return '库存待确认';
  return stock === 0 ? '暂时售罄' : '库存 ' + stock;
}
