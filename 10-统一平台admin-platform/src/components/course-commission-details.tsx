"use client";
import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import Link from "next/link";
import {
  Alert,
  App,
  AutoComplete,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Dropdown,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Spin,
  Tabs,
  Tag,
  Typography,
} from "antd";
import { Table } from "@/components/adaptive-table";
import { DownloadOutlined, SearchOutlined } from "@ant-design/icons";
import { commissionExportRows } from "@/lib/commission-export";
import { trainingApi } from "@/lib/api";
import {
  buildCourseAdvisorOptions,
  filterCourseAdvisorOption,
} from "@/lib/course-advisors";
import { formatPaymentAmount } from "@/lib/money-format";
import { compareTableValues, sortableColumns } from "@/lib/table-sort";

const { Text, Title } = Typography;
const MAIN_TABLE_SCROLL_Y = "max(240px, calc(100dvh - 440px))";

type PaymentRow = {
  id: number;
  source?: string;
  memberId?: number;
  memberName?: string;
  memberPhone?: string;
  courseId?: number;
  courseName?: string;
  courseSubType?: string;
  amount?: number;
  date?: string;
  payment?: string;
  sales?: string;
  commissionRate?: number;
  commissionAmount?: number;
  remark?: string;
  remainingSessions?: number;
  created_at?: string;
};

type CommissionDetailRow = PaymentRow & {
  advisor: string;
  paidAmount: number;
  rate: number;
  commission: number;
  month: string;
  year: string;
};

type SummaryRow = {
  key: string;
  advisor: string;
  period?: string;
  paymentCount: number;
  paidAmount: number;
  commission: number;
  avgRate: number;
  latestDate: string;
  settled?: boolean;
};

type SettlementRow = {
  period: string;
  advisor: string;
  status: string;
};

function numberValue(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function textValue(value: unknown, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function dateText(value: unknown) {
  return String(value || "-")
    .replace("T", " ")
    .slice(0, 10);
}

function monthKey(value: unknown) {
  const text = dateText(value);
  return text.length >= 7 ? text.slice(0, 7) : "未标记";
}

function yearKey(value: unknown) {
  const text = dateText(value);
  return /^\d{4}/.test(text) ? text.slice(0, 4) : "未标记";
}

function money(value: unknown) {
  return formatPaymentAmount(value);
}

function advisorName(value: unknown) {
  return textValue(value, "未填写顾问");
}

function commissionFromPayment(row: PaymentRow) {
  const paidAmount = numberValue(row.amount);
  const rate = numberValue(row.commissionRate);
  const storedCommission = numberValue(row.commissionAmount, Number.NaN);
  const commission = Number.isFinite(storedCommission)
    ? storedCommission
    : Math.round(((paidAmount * rate) / 100) * 100) / 100;
  return { paidAmount, rate, commission };
}

function toDetailRow(row: PaymentRow): CommissionDetailRow {
  const { paidAmount, rate, commission } = commissionFromPayment(row);
  return {
    ...row,
    advisor: advisorName(row.sales),
    paidAmount,
    rate,
    commission,
    month: monthKey(row.date || row.created_at),
    year: yearKey(row.date || row.created_at),
  };
}

function summarizeRows(
  rows: CommissionDetailRow[],
  keyFor: (row: CommissionDetailRow) => {
    key: string;
    advisor: string;
    period?: string;
  },
) {
  const map = new Map<string, SummaryRow>();
  rows.forEach((row) => {
    const keyInfo = keyFor(row);
    const current = map.get(keyInfo.key) || {
      key: keyInfo.key,
      advisor: keyInfo.advisor,
      period: keyInfo.period,
      paymentCount: 0,
      paidAmount: 0,
      commission: 0,
      avgRate: 0,
      latestDate: "",
    };
    current.paymentCount += 1;
    current.paidAmount += row.paidAmount;
    current.commission += row.commission;
    const rowDate = dateText(row.date || row.created_at);
    if (!current.latestDate || rowDate > current.latestDate)
      current.latestDate = rowDate;
    current.avgRate = current.paidAmount
      ? Math.round((current.commission / current.paidAmount) * 100 * 100) / 100
      : 0;
    map.set(keyInfo.key, current);
  });
  return Array.from(map.values()).sort((a, b) => b.commission - a.commission);
}

export default function CourseCommissionDetails() {
  const { message } = App.useApp();
  const [editForm] = Form.useForm();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [settlements, setSettlements] = useState<SettlementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [advisorFilter, setAdvisorFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [exporting, setExporting] = useState(false);
  const [editingPayment, setEditingPayment] =
    useState<CommissionDetailRow | null>(null);
  const editAmount = Form.useWatch("amount", editForm);
  const editCommissionRate = Form.useWatch("commissionRate", editForm);

  const loadPayments = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [paymentRows, settlementRows, onlineRows] = await Promise.all([
        trainingApi.getPayments(),
        trainingApi.getCommissionSettlements(),
        trainingApi.getOnlineAuthorizationCommissions(),
      ]);
      if (
        !Array.isArray(paymentRows) ||
        !Array.isArray(settlementRows) ||
        !Array.isArray(onlineRows)
      ) {
        throw new Error("提成数据格式异常，请重试");
      }
      setPayments([...paymentRows, ...onlineRows]);
      setSettlements(settlementRows);
    } catch (error: any) {
      setLoadError(
        error?.response?.data?.error || error?.message || "提成数据加载失败",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, []);

  useEffect(() => {
    try {
      const raw =
        localStorage.getItem("admin_user") || localStorage.getItem("userData");
      const user = raw ? JSON.parse(raw) : {};
      setIsSuperAdmin(user?.username === "lilei" || user?.role === "admin");
    } catch {
      setIsSuperAdmin(false);
    }
  }, []);

  useEffect(() => {
    if (!editingPayment) return;
    const amount = numberValue(editAmount);
    const rate = numberValue(editCommissionRate);
    editForm.setFieldsValue({
      commissionAmount: Math.round(((amount * rate) / 100) * 100) / 100,
    });
  }, [editAmount, editCommissionRate, editForm, editingPayment]);

  const openPaymentEdit = (record: CommissionDetailRow) => {
    if (record.source === "online") {
      message.info("线上授权记录已纳入统计，实收与提成以授权时保存的金额为准");
      return;
    }
    if (isSettled(record.advisor, record.month)) {
      message.warning("该月份提成已确认或历史已结清，不能从明细覆盖修改");
      return;
    }
    setEditingPayment(record);
    editForm.setFieldsValue({
      date: record.date ? dayjs(record.date) : null,
      sales: record.sales || "",
      amount: record.paidAmount,
      commissionRate: record.rate,
      commissionAmount: record.commission,
      remainingSessions: record.remainingSessions ?? 0,
      remark: record.remark || "",
    });
  };

  const savePaymentEdit = async () => {
    if (!editingPayment) return;
    const values = await editForm.validateFields();
    const amount = numberValue(values.amount);
    const commissionRate = numberValue(values.commissionRate);
    const commissionAmount =
      Math.round(((amount * commissionRate) / 100) * 100) / 100;
    setSaving(true);
    try {
      await trainingApi.updatePayment(editingPayment.id, {
        amount,
        commissionRate,
        commissionAmount,
        date: values.date ? values.date.format("YYYY-MM-DD") : "",
        sales: String(values.sales || "").trim(),
        remainingSessions:
          values.remainingSessions ?? editingPayment.remainingSessions ?? 0,
        remark: values.remark || "",
      });
      message.success("缴费记录已更新");
      setEditingPayment(null);
      loadPayments();
    } catch (error: any) {
      message.error(
        error?.response?.data?.error || error?.message || "保存缴费记录失败",
      );
    } finally {
      setSaving(false);
    }
  };

  const detailRows = useMemo(
    () =>
      payments
        .map(toDetailRow)
        .filter((row) => row.commission > 0)
        .sort(
          (a, b) =>
            String(b.date || b.created_at || "").localeCompare(
              String(a.date || a.created_at || ""),
            ) ||
            String(b.created_at || "").localeCompare(
              String(a.created_at || ""),
            ) ||
            b.id - a.id,
        ),
    [payments],
  );
  const advisorInputOptions = useMemo(
    () => buildCourseAdvisorOptions(detailRows.map((row) => row.advisor)),
    [detailRows],
  );
  const advisorSelectOptions = useMemo(
    () => [{ value: "all", label: "全部课程顾问" }, ...advisorInputOptions],
    [advisorInputOptions],
  );
  const yearOptions = useMemo(
    () => [
      "all",
      ...Array.from(new Set(detailRows.map((row) => row.year))).sort((a, b) =>
        b.localeCompare(a),
      ),
    ],
    [detailRows],
  );
  const settledKeys = useMemo(
    () =>
      new Set(
        settlements
          .filter((row) => row.status === "settled")
          .map((row) => `${row.period}||${row.advisor}`),
      ),
    [settlements],
  );
  const isSettled = (advisor: string, period: string) =>
    settledKeys.has(`${period}||${advisor}`);

  const filteredRows = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    return detailRows.filter((row) => {
      if (advisorFilter !== "all" && row.advisor !== advisorFilter)
        return false;
      if (yearFilter !== "all" && row.year !== yearFilter) return false;
      if (monthFilter !== "all" && row.month.slice(5, 7) !== monthFilter)
        return false;
      if (!query) return true;
      return [
        row.advisor,
        row.memberName,
        row.memberPhone,
        row.courseName,
        row.courseSubType,
        row.remark,
      ].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(query),
      );
    });
  }, [advisorFilter, detailRows, keyword, yearFilter, monthFilter]);

  const exportCommissionList = async (scope: "filtered" | "all") => {
    const rows = scope === "all" ? detailRows : filteredRows;
    if (!rows.length) {
      message.info("暂无可导出的提成记录");
      return;
    }
    setExporting(true);
    try {
      const { default: writeXlsxFile } = await import(
        "write-excel-file/browser"
      );
      await writeXlsxFile(commissionExportRows(rows)).toFile(
        `奖金提成_${scope === "all" ? "全部清单" : "当前筛选"}_${dayjs().format("YYYYMMDD_HHmmss")}.xlsx`,
      );
      message.success(`已导出 ${rows.length} 条提成记录`);
    } catch (error: any) {
      message.error(error?.message || "导出失败");
    } finally {
      setExporting(false);
    }
  };

  const advisorRows = useMemo(
    () =>
      summarizeRows(filteredRows, (row) => ({
        key: row.advisor,
        advisor: row.advisor,
      })),
    [filteredRows],
  );
  const monthlyRows = useMemo(
    () =>
      summarizeRows(filteredRows, (row) => ({
        key: `${row.month}-${row.advisor}`,
        advisor: row.advisor,
        period: row.month,
      }))
        .map((row) => ({
          ...row,
          settled: isSettled(row.advisor, row.period || ""),
        }))
        .sort(
          (a, b) =>
            compareTableValues(b.period || "", a.period || "") ||
            compareTableValues(a.advisor, b.advisor) ||
            compareTableValues(b.commission, a.commission),
        ),
    [filteredRows, settledKeys],
  );
  const yearlyRows = useMemo(
    () =>
      summarizeRows(filteredRows, (row) => ({
        key: `${row.year}-${row.advisor}`,
        advisor: row.advisor,
        period: row.year,
      })),
    [filteredRows],
  );

  const summaryColumns = (
    periodTitle?: string,
    withSettlement = false,
    defaultPeriodSortOrder?: "ascend" | "descend",
  ) => [
    {
      title: "课程顾问",
      dataIndex: "advisor",
      width: 140,
      render: (value: string) => <Text strong>{value}</Text>,
    },
    ...(periodTitle
      ? [
          {
            title: periodTitle,
            dataIndex: "period",
            width: 110,
            defaultSortOrder: defaultPeriodSortOrder,
            sorter: (a: SummaryRow, b: SummaryRow) =>
              compareTableValues(a.period || "", b.period || ""),
            render: (value: string) => value || "-",
          },
        ]
      : []),
    {
      title: "缴费笔数",
      dataIndex: "paymentCount",
      align: "right" as const,
      width: 100,
      sorter: (a: SummaryRow, b: SummaryRow) =>
        compareTableValues(a.paymentCount, b.paymentCount),
    },
    {
      title: "实付金额",
      dataIndex: "paidAmount",
      align: "right" as const,
      width: 120,
      sorter: (a: SummaryRow, b: SummaryRow) =>
        compareTableValues(a.paidAmount, b.paidAmount),
      render: money,
    },
    {
      title: "提成金额",
      dataIndex: "commission",
      align: "right" as const,
      width: 130,
      sorter: (a: SummaryRow, b: SummaryRow) =>
        compareTableValues(a.commission, b.commission),
      render: (value: number) => (
        <Text strong style={{ color: "#F72A8A" }}>
          {money(value)}
        </Text>
      ),
    },
    ...(withSettlement
      ? [
          {
            title: "结算锁定",
            dataIndex: "settled",
            align: "center" as const,
            width: 120,
            render: (value: boolean) => (
              <Tag color={value ? "purple" : "default"}>
                {value ? "已锁定" : "未锁定"}
              </Tag>
            ),
          },
        ]
      : []),
  ];

  const detailColumns = sortableColumns<CommissionDetailRow>([
    {
      title: "来源",
      width: 100,
      render: (_: unknown, row: CommissionDetailRow) =>
        row.source === "online" ? (
          <Link href="/online-course/auth">线上授权</Link>
        ) : (
          "线下缴费"
        ),
    },
    { title: "缴费日期", dataIndex: "date", width: 110, render: dateText },
    {
      title: "课程顾问",
      dataIndex: "advisor",
      width: 130,
      render: (value) => (
        <Tag color={value === "未填写顾问" ? "default" : "magenta"}>
          {value}
        </Tag>
      ),
    },
    {
      title: "学员",
      dataIndex: "memberName",
      width: 120,
      render: (value) => value || "-",
    },
    {
      title: "手机号",
      dataIndex: "memberPhone",
      width: 130,
      render: (value) => value || "-",
    },
    {
      title: "课程",
      dataIndex: "courseName",
      width: 220,
      ellipsis: true,
      render: (value) => value || "-",
    },
    {
      title: "课程期次",
      dataIndex: "courseSubType",
      width: 120,
      render: (value) => value || "-",
    },
    {
      title: "实付金额",
      dataIndex: "paidAmount",
      align: "right" as const,
      width: 120,
      render: money,
    },
    {
      title: "提成比例",
      dataIndex: "rate",
      align: "right" as const,
      width: 110,
      render: (value) => `${numberValue(value)}%`,
    },
    {
      title: "提成金额",
      dataIndex: "commission",
      align: "right" as const,
      width: 120,
      render: (value) => (
        <Text strong style={{ color: "#F72A8A" }}>
          {money(value)}
        </Text>
      ),
    },
    {
      title: "备注",
      dataIndex: "remark",
      width: 180,
      ellipsis: true,
      render: (value) => value || "-",
    },
  ]);

  if (loadError) {
    return (
      <div className="bonus-commission-page">
        <Title level={2}>奖金提成</Title>
        <Alert
          type="error"
          showIcon
          message="提成数据加载失败"
          description={loadError}
          action={<Button onClick={loadPayments}>重新加载</Button>}
        />
      </div>
    );
  }

  if (loading) {
    return <Spin style={{ width: "100%", marginTop: 120 }} />;
  }

  return (
    <div className="bonus-commission-page">
      <Tabs
        defaultActiveKey="detail"
        items={[
          {
            key: "detail",
            label: `提成详单 ${filteredRows.length}`,
            children: (
              <Card styles={{ body: { padding: 0 } }}>
                <Table<CommissionDetailRow>
                  rowKey={(row) => `${row.source || "offline"}-${row.id}`}
                  size="middle"
                  dataSource={filteredRows}
                  columns={detailColumns}
                  scroll={{ x: 1460, y: MAIN_TABLE_SCROLL_Y }}
                  pagination={{ pageSize: 20, showSizeChanger: true }}
                  locale={{ emptyText: <Empty description="暂无提成详单" /> }}
                  onRow={(record) => ({
                    onClick: () => openPaymentEdit(record),
                    style: {
                      cursor:
                        isSettled(record.advisor, record.month) && !isSuperAdmin
                          ? "not-allowed"
                          : "pointer",
                    },
                  })}
                />
              </Card>
            ),
          },
          {
            key: "advisor",
            label: `顾问汇总 ${advisorRows.length}`,
            children: (
              <Card styles={{ body: { padding: 0 } }}>
                <Table<SummaryRow>
                  rowKey="key"
                  size="middle"
                  dataSource={advisorRows}
                  columns={sortableColumns<SummaryRow>(summaryColumns())}
                  scroll={{ x: 860, y: MAIN_TABLE_SCROLL_Y }}
                  pagination={{ pageSize: 20, showSizeChanger: true }}
                  locale={{ emptyText: <Empty description="暂无提成数据" /> }}
                />
              </Card>
            ),
          },
          {
            key: "month",
            label: `月度统计 ${monthlyRows.length}`,
            children: (
              <Card styles={{ body: { padding: 0 } }}>
                <Table<SummaryRow>
                  rowKey="key"
                  size="middle"
                  dataSource={monthlyRows}
                  columns={sortableColumns<SummaryRow>(
                    summaryColumns("月份", true, "descend"),
                  )}
                  scroll={{ x: 860, y: MAIN_TABLE_SCROLL_Y }}
                  pagination={{ pageSize: 20, showSizeChanger: true }}
                  locale={{ emptyText: <Empty description="暂无月度统计" /> }}
                />
              </Card>
            ),
          },
          {
            key: "year",
            label: `年度统计 ${yearlyRows.length}`,
            children: (
              <Card styles={{ body: { padding: 0 } }}>
                <Table<SummaryRow>
                  rowKey="key"
                  size="middle"
                  dataSource={yearlyRows}
                  columns={sortableColumns<SummaryRow>(summaryColumns("年份"))}
                  scroll={{ x: 860, y: MAIN_TABLE_SCROLL_Y }}
                  pagination={{ pageSize: 20, showSizeChanger: true }}
                  locale={{ emptyText: <Empty description="暂无年度统计" /> }}
                />
              </Card>
            ),
          },
        ]}
        tabBarExtraContent={
          <div className="commission-toolbar">
            <Input
              className="commission-search"
              prefix={<SearchOutlined />}
              allowClear
              placeholder="搜索顾问、学员、手机号、课程"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
            <Select
              style={{ width: 140 }}
              aria-label="课程顾问"
              value={advisorFilter}
              onChange={setAdvisorFilter}
              options={advisorSelectOptions}
            />
            <Select
              style={{ width: 105 }}
              aria-label="年份"
              value={yearFilter}
              onChange={setYearFilter}
              options={yearOptions.map((value) => ({
                value,
                label: value === "all" ? "全部年份" : value,
              }))}
            />
            <Select
              style={{ width: 100 }}
              aria-label="月份"
              value={monthFilter}
              onChange={setMonthFilter}
              options={[
                { value: "all", label: "全部月份" },
                ...Array.from({ length: 12 }, (_, index) => ({
                  value: String(index + 1).padStart(2, "0"),
                  label: `${index + 1}月`,
                })),
              ]}
            />
            <Text type="secondary" style={{ whiteSpace: "nowrap" }}>
              共 {filteredRows.length} 条
            </Text>
            <Dropdown
              trigger={["click"]}
              menu={{
                items: [
                  {
                    key: "filtered",
                    label: `导出当前筛选清单（${filteredRows.length}条）`,
                    disabled: !filteredRows.length,
                  },
                  {
                    key: "all",
                    label: `导出全部清单（${detailRows.length}条）`,
                    disabled: !detailRows.length,
                  },
                ],
                onClick: ({ key }) => {
                  void exportCommissionList(key as "filtered" | "all");
                },
              }}
              disabled={loading || exporting}
            >
              <Button icon={<DownloadOutlined />} loading={exporting}>
                导出
              </Button>
            </Dropdown>
          </div>
        }
      />

      <style jsx global>{`
        .bonus-commission-page .commission-stats .ant-statistic {
          display: flex;
          align-items: baseline;
          gap: 10px;
          white-space: nowrap;
        }
        .bonus-commission-page .commission-stats .ant-statistic-title {
          margin-bottom: 0;
        }
        .bonus-commission-page .commission-toolbar {
          display: flex;
          gap: 8px;
          align-items: center;
          justify-content: flex-end;
          flex-wrap: wrap;
          padding: 4px 0;
        }
        .bonus-commission-page .commission-search {
          width: 220px;
        }
        .bonus-commission-page .ant-tabs-nav {
          flex-wrap: wrap;
          gap: 8px;
        }
        .bonus-commission-page .ant-tabs-nav-wrap {
          flex: 1;
          min-width: 320px;
        }
        .bonus-commission-page .ant-tabs-extra-content {
          max-width: 100%;
        }
        @media (max-width: 1400px) {
          .bonus-commission-page .ant-tabs-extra-content {
            width: 100%;
          }
        }
        @media (max-width: 600px) {
          .bonus-commission-page .commission-search {
            width: 100%;
          }
          .bonus-commission-page .commission-stats .ant-statistic {
            display: flex;
            align-items: baseline;
            gap: 10px;
            white-space: nowrap;
          }
          .bonus-commission-page .commission-stats .ant-statistic-title {
            margin-bottom: 0;
          }
          .bonus-commission-page .commission-toolbar {
            justify-content: flex-start;
          }
          .bonus-commission-page .ant-tabs-nav-wrap {
            min-width: 0;
          }
        }
      `}</style>

      <Modal
        title="编辑缴费记录"
        open={Boolean(editingPayment)}
        onCancel={() => setEditingPayment(null)}
        onOk={savePaymentEdit}
        confirmLoading={saving}
        width={680}
        destroyOnHidden
      >
        {editingPayment && (
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            <Descriptions size="small" bordered column={2}>
              <Descriptions.Item label="学员">
                {editingPayment.memberName || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="手机号">
                {editingPayment.memberPhone || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="课程">
                {editingPayment.courseName || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="课程期次">
                {editingPayment.courseSubType || "-"}
              </Descriptions.Item>
            </Descriptions>
            <Form form={editForm} layout="vertical">
              <Row gutter={[12, 0]}>
                <Col xs={24} md={8}>
                  <Form.Item
                    name="date"
                    label="缴费日期"
                    rules={[{ required: true, message: "请选择缴费日期" }]}
                  >
                    <DatePicker style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="sales" label="课程顾问">
                    <AutoComplete
                      allowClear
                      options={advisorInputOptions}
                      filterOption={filterCourseAdvisorOption}
                      placeholder="海艳、七七、伊琳、伊娃老师"
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item
                    name="amount"
                    label="实付金额"
                    rules={[{ required: true, message: "请输入实付金额" }]}
                  >
                    <InputNumber
                      min={0}
                      precision={2}
                      style={{ width: "100%" }}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="commissionRate" label="提成比例">
                    <InputNumber
                      min={0}
                      max={100}
                      precision={2}
                      suffix="%"
                      style={{ width: "100%" }}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="commissionAmount" label="提成金额">
                    <InputNumber
                      disabled
                      precision={2}
                      style={{ width: "100%" }}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="remainingSessions" label="剩余课时">
                    <InputNumber
                      min={0}
                      precision={0}
                      style={{ width: "100%" }}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24}>
                  <Form.Item name="remark" label="备注">
                    <Input.TextArea autoSize={{ minRows: 2 }} />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </Space>
        )}
      </Modal>
    </div>
  );
}
