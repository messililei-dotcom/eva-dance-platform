import type { SheetData } from 'write-excel-file/browser';

type ExportRow = {
  id: number; source?: string; date?: string; advisor: string; memberName?: string;
  memberPhone?: string; courseName?: string; courseSubType?: string;
  paidAmount: number; rate: number; commission: number; remark?: string;
};

export function commissionExportRows(rows: ExportRow[]): SheetData {
  const headers = ['来源', '记录编号', '缴费日期', '课程顾问', '学员', '手机号', '课程', '课程期次', '实付金额', '提成比例（%）', '提成金额', '备注'];
  return [
    headers.map(value => ({ value, type: String, fontWeight: 'bold' as const })),
    ...rows.map(row => [
      { value: row.source === 'online' ? '线上授权' : '线下缴费', type: String },
      { value: String(row.id), type: String },
      ...[row.date, row.advisor, row.memberName, row.memberPhone, row.courseName, row.courseSubType].map(value => ({ value: String(value ?? ''), type: String })),
      { value: row.paidAmount, type: Number, format: '0.00' },
      { value: row.rate, type: Number, format: '0.00' },
      { value: row.commission, type: Number, format: '0.00' },
      { value: String(row.remark ?? ''), type: String },
    ]),
  ];
}
