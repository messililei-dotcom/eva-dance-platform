import type { BonusSummary } from "./server/bonus-management";
const labels: Record<string, string> = {
  online: "线上课程提成",
  offline: "线下课程提成",
  product: "商品团队提成",
  lesson: "课时费",
  adjustment: "调整",
  salary: "工资",
  reimbursement: "报销",
};
export function bonusWorkbook(period: string, rows: BonusSummary[]) {
  const summaryHeaders = [
    "月份",
    "姓名",
    "线上提成",
    "线下提成",
    "商品团队提成",
    "课时费",
    "工资",
    "报销",
    "调整",
    "应发合计",
    "审核状态",
    "发放状态",
    "审核人",
    "审核时间",
    "发放人",
    "发放日期",
    "凭证",
  ];
  const summary = rows.map((r) => [
    period,
    r.person,
    r.online,
    r.offline,
    r.product,
    r.lesson,
    r.salary || 0,
    r.reimbursement || 0,
    r.adjustment,
    r.total,
    r.audit === "confirmed" ? "已确认" : "待审核",
    r.payout === "paid" ? "已发放" : "未发放",
    r.reviewedBy || "",
    r.reviewedAt || "",
    r.paidBy || "",
    r.paidAt || "",
    r.voucher || "",
  ]);
  const detailHeaders = [
    "月份",
    "姓名",
    "类型",
    "日期",
    "内容",
    "学员姓名",
    "实收金额",
    "奖励比例%",
    "节数",
    "单节金额",
    "金额",
    "调整原因",
    "凭证说明",
  ];
  const details = rows.flatMap((r) =>
    r.details
      .filter((d) => d.amount !== 0)
      .map((d) => [
        period,
        r.person,
        labels[d.type],
        d.date,
        d.title,
        d.memberName || "",
        d.base ?? "",
        d.rate ?? "",
        d.sessions ?? "",
        d.unit ?? "",
        d.amount,
        d.reason || "",
        d.voucher || "",
      ]),
  );
  const sheet = (header: string[], values: (string | number)[][]) => [
    header.map((value) => ({
      value,
      type: String,
      fontWeight: "bold" as const,
    })),
    ...values.map((row) =>
      row.map((value) => ({
        value,
        type: typeof value === "number" ? Number : String,
      })),
    ),
  ];
  return [
    { sheet: "月度结算", data: sheet(summaryHeaders, summary) },
    { sheet: "结算明细", data: sheet(detailHeaders, details) },
  ];
}
