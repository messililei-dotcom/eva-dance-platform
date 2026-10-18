export function calculateSaleCommission(amount: unknown, rate: unknown): number {
  const base = Number(amount ?? 0);
  const percent = Number(rate ?? 0);
  if (!Number.isFinite(base) || !Number.isFinite(percent)) return 0;
  return Math.round((base * percent / 100 + Number.EPSILON) * 100) / 100;
}

export function saleCommissionFields(
  input: Record<string, unknown>,
  amount: number,
  previous?: { sales_advisor?: string; commission_rate?: number },
) {
  const salesAdvisor = String(input.salesAdvisor ?? input.sales_advisor ?? previous?.sales_advisor ?? '').trim();
  const rawRate = input.commissionRate ?? input.commission_rate ?? previous?.commission_rate ?? 0;
  const commissionRate = Number(rawRate);
  if (rawRate === '' || !Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate > 100)
    throw new Error('提成比例必须在 0% 到 100% 之间');
  if (!Number.isFinite(amount) || amount < 0) throw new Error('实收金额不能为负数');
  if (salesAdvisor.length > 100) throw new Error('销售顾问姓名不能超过 100 字');
  if (commissionRate > 0 && !salesAdvisor) throw new Error('有提成时请填写销售顾问');
  return { salesAdvisor, commissionRate, commissionAmount: calculateSaleCommission(amount, commissionRate) };
}
