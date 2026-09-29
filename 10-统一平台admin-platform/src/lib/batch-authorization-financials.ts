export function splitBatchReceipt(ids: number[], amount: unknown, rate: unknown) {
  const total = Number(amount), percent = Number(rate);
  if (!ids.length || new Set(ids).size !== ids.length || ids.some(id => !Number.isInteger(id) || id <= 0)) throw new Error('请选择有效课程');
  if (amount === undefined || amount === null || amount === '' || !Number.isFinite(total) || total < 0 || total > 999999999) throw new Error('请输入有效的实收金额');
  if (rate === undefined || rate === null || rate === '' || !Number.isFinite(percent) || percent < 0 || percent > 100) throw new Error('提成比例应为 0–100%');
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / ids.length), remainder = cents % ids.length;
  let allocatedCents = 0;
  const roundedRate = Math.round(percent * 100) / 100;
  return ids.map((id, index) => {
    const actual_amount = (base + (index < remainder ? 1 : 0)) / 100;
    const previousCommission = Math.round(allocatedCents * roundedRate / 100);
    allocatedCents += base + (index < remainder ? 1 : 0);
    return { id, actual_amount, commission_rate: Math.round(percent * 100) / 100,
      commission_amount: (Math.round(allocatedCents * roundedRate / 100) - previousCommission) / 100 };
  });
}
