type Values = {
  actual_amount?: number | null;
  commission_amount?: number | null;
  commission_rate?: number | null;
  commission_basis?: string;
};
export function authorizationRate(paid: number, bonus: number) {
  return paid > 0 ? Math.round((bonus / paid) * 10000) / 100 : 0;
}
export function authorizationBonus(paid: number, rate: number) {
  return Math.round(paid * rate) / 100;
}
export function initialAuthorizationFinancials(record: Values) {
  if (record.actual_amount == null) {
    const rate = Math.round(Number(record.commission_rate ?? 0) * 100) / 100;
    return {
      actual_amount: null,
      commission_amount: record.commission_amount ?? null,
      commission_rate: Number.isFinite(rate) && rate >= 0 && rate <= 100 ? rate : 0,
      commission_basis: 'rate',
    };
  }
  const paid = Number(record.actual_amount ?? 0),
    bonus = Number(record.commission_amount ?? 0),
    rate = Math.round(Number(record.commission_rate ?? 0) * 100) / 100;
  const consistent =
    record.commission_rate != null &&
    Number.isFinite(rate) &&
    rate >= 0 &&
    rate <= 100 &&
    authorizationBonus(paid, rate) === Math.round(bonus * 100) / 100;
  return {
    actual_amount: paid,
    commission_amount: bonus,
    commission_rate: consistent ? rate : authorizationRate(paid, bonus),
    commission_basis: consistent ? "rate" : "amount",
  };
}
export function authorizationFinancialPatch(changed: Values, values: Values) {
  const paid = Number(values.actual_amount || 0);
  if ("commission_amount" in changed)
    return {
      commission_rate: authorizationRate(
        paid,
        Number(values.commission_amount || 0),
      ),
      commission_basis: "amount",
    };
  if ("actual_amount" in changed || "commission_rate" in changed)
    return {
      commission_amount: authorizationBonus(
        paid,
        Number(values.commission_rate || 0),
      ),
      commission_basis: "rate",
    };
  return {};
}
export function resolveAuthorizationRate(
  paid: number,
  bonus: number,
  values: Values,
) {
  const derived = authorizationRate(paid, bonus);
  if (values.commission_basis == null) return derived; // compatibility with older clients
  if (!["amount", "rate"].includes(values.commission_basis))
    throw new Error("提成计算方式无效");
  const rate = Number(values.commission_rate);
  if (
    values.commission_rate == null ||
    String(values.commission_rate).trim() === '' ||
    !Number.isFinite(rate) ||
    rate < 0 ||
    rate > 100
  )
    throw new Error("提成比例应在0至100%之间");
  if (rate !== Math.round(rate * 100) / 100)
    throw new Error('提成比例最多保留两位小数');
  if (values.commission_basis === "rate") {
    if (authorizationBonus(paid, rate) !== bonus)
      throw new Error("提成金额与比例不一致，请重新核对");
    return Math.round(rate * 100) / 100;
  }
  if (Math.round(rate * 100) / 100 !== derived)
    throw new Error("提成比例与金额不一致，请重新核对");
  return derived;
}
