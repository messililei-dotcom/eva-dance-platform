"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import dayjs from "dayjs";
import {
  Alert,
  App,
  AutoComplete,
  Button,
  Card,
  Checkbox,
  ConfigProvider,
  DatePicker,
  Descriptions,
  Dropdown,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Typography,
  Upload,
} from "antd";
import {
  DownloadOutlined,
  PlusOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { api } from "@/lib/api";
import { bonusWorkbook } from "@/lib/bonus-export";
import { compareTableValues, sortableColumns } from "@/lib/table-sort";
import { useAuth } from "@/lib/auth-context";
import CourseCommissionDetails from "@/components/course-commission-details";
import type { BonusDetail, BonusSummary } from "@/lib/server/bonus-management";
import styles from "./settlement.module.css";

const money = (n: number = 0) =>
  new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
const kinds: Record<string, string> = {
  online: "线上课程提成",
  offline: "线下课程提成",
  product: "商品团队提成",
  lesson: "课时费",
  adjustment: "调整",
  salary: "工资",
  reimbursement: "报销",
};
const channels = ["淘宝", "抖音", "视频号小店", "线下"];
type Payload = {
  rows: BonusSummary[];
  entries: any[];
  standards: any[];
  logs: any[];
  admin: boolean;
  canReview: boolean;
  canPay: boolean;
  courses: any[];
  products: any[];
  salespeople: any[];
};
const blank: Payload = {
  rows: [],
  entries: [],
  standards: [],
  logs: [],
  admin: false,
  canReview: false,
  canPay: false,
  courses: [],
  products: [],
  salespeople: [],
};
export default function BonusCommissionPage() {
  const { message } = App.useApp(),
    { user } = useAuth();
  const [data, setData] = useState<Payload>(blank),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const [period, setPeriod] = useState(() => dayjs().subtract(1, "month").format("YYYY-MM")),
    [person, setPerson] = useState<string>(),
    [audit, setAudit] = useState("all"),
    [payout, setPayout] = useState("all"),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState(""),
    [tab, setTab] = useState("monthly");
  const [modal, setModal] = useState(""),
    [editing, setEditing] = useState<any>(),
    [form] = Form.useForm(),
    [importRows, setImportRows] = useState<any[]>([]),
    [importConfirmed, setImportConfirmed] = useState(false),
    [exporting, setExporting] = useState(false);
  const [detailPagination, setDetailPagination] = useState({
    current: 1,
    pageSize: 6,
  });
  const [uploading, setUploading] = useState(0);
  const loadVersion = useRef(0);
  const load = async () => {
    const version = ++loadVersion.current;
    setLoading(true);
    setError("");
    setData(blank);
    try {
      const res = await api.get("/bonus-management", { params: { period } });
      if (version === loadVersion.current) setData(res.data);
    } catch (e: any) {
      if (version === loadVersion.current)
        setError(e.response?.data?.error || e.message);
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, [period]); // eslint-disable-line react-hooks/exhaustive-deps
  const filtered = useMemo(
    () =>
      data.rows.filter(
        (r) =>
          (!person || r.person === person) &&
          (audit === "all" || r.audit === audit) &&
          (payout === "all" || r.payout === payout) &&
          (!search || r.person.includes(search)),
      ),
    [data, person, audit, payout, search],
  );
  const current = filtered.find((r) => r.person === selected) || filtered[0];
  useEffect(() => {
    setDetailPagination((p) => ({ ...p, current: 1 }));
  }, [period, current?.person]);
  const totals = data.rows.reduce(
    (v, r) => ({
      total: v.total + r.total,
      unpaid: v.unpaid + (r.payout === "unpaid" ? r.total : 0),
      paid: v.paid + (r.payout === "paid" ? r.total : 0),
      pending: v.pending + (r.audit === "pending" ? 1 : 0),
    }),
    { total: 0, unpaid: 0, paid: 0, pending: 0 },
  );
  const selectedDate = Form.useWatch("date", form),
    received = Form.useWatch("received", form),
    rate = Form.useWatch("rate", form),
    sessions = Form.useWatch("sessions", form),
    unit = Form.useWatch("unit", form),
    courseGroup = Form.useWatch("courseGroup", form),
    voucherFiles = Form.useWatch("voucherFiles", form) || [];
  const standard = data.standards.find(
    (s) =>
      s.effectiveDate <=
      (selectedDate?.format?.("YYYY-MM-DD") || dayjs().format("YYYY-MM-DD")),
  );
  const request = async (body: any) => {
    const res = await api.post("/bonus-management", body);
    return res.data;
  };
  const execute = async (body: any) => {
    setSaving(true);
    try {
      await request(body);
      message.success("已保存");
      await load();
    } catch (e: any) {
      message.error(e.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  };
  const open = (kind: string, entry?: any) => {
    setEditing(entry);
    setModal(kind);
    form.resetFields();
    if (kind === "import") {
      setImportRows([]);
      setImportConfirmed(false);
    }
    const effective = data.standards.find(
      (s) => s.effectiveDate <= dayjs().format("YYYY-MM-DD"),
    );
    form.setFieldsValue(
      entry
        ? {
            ...entry,
            courseGroup: data.courses.find((c) => c.id === entry.courseId)
              ?.name,
            date: dayjs(entry.date),
            period: dayjs(entry.period),
          }
        : {
            date: dayjs(),
            period: dayjs(),
            productLines: [{ quantity: 1 }],
            requestKey: crypto.randomUUID(),
            salesperson: user?.name || user?.username,
            rate: effective?.productRate ?? 25,
            unit: effective?.lessonUnit,
            sessions: 1,
            channel: "线下",
            refund: 0,
            state: "正常",
            person: current?.person,
            effectiveDate: dayjs(),
            productRate: effective?.productRate ?? 25,
            lessonUnit: effective?.lessonUnit,
            paidDate: dayjs(),
          },
    );
  };
  const save = async () => {
    if (uploading) {
      message.info("请等待截图上传完成");
      return;
    }
    if (modal === "reimbursement" && !(form.getFieldValue("voucherFiles")||[]).length && !editing?.voucher) {message.error("请上传报销截图凭证");return;}
    const v = await form.validateFields();
    setSaving(true);
    try {
      const body = {
        ...v,
        id: editing?.id,
        expectedUpdatedAt: editing?.updatedAt,
        requestKey: modal === "product" ? (editing?.requestKey || form.getFieldValue("requestKey")) : undefined,
        kind: modal,
        date: v.date?.format("YYYY-MM-DD"),
        period: v.period?.format("YYYY-MM") || period,
      };
      if (modal === "standard")
        Object.assign(body, {
          action: "standard",
          effectiveDate: v.effectiveDate.format("YYYY-MM-DD"),
        });
      if (modal === "pay")
        Object.assign(body, {
          action: "pay",
          person: current?.person,
          period,
          paidDate: v.paidDate.format("YYYY-MM-DD"),
        });
      await request(body);
      message.success("已保存");
      setModal("");
      await load();
    } catch (e: any) {
      message.error(e.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  };
  const exportFile = async (rows: BonusSummary[] = filtered) => {
    setExporting(true);
    try {
      const { default: write } = await import("write-excel-file/browser");
      await write(bonusWorkbook(period, rows)).toFile(
        `奖金提成-${period}.xlsx`,
      );
    } catch (e: any) {
      message.error(e.message || "导出失败");
    } finally {
      setExporting(false);
    }
  };
  const readImport = async (file: File) => {
    setImportRows([]);
    setImportConfirmed(false);
    try {
      const { default: read } = await import("read-excel-file/browser");
      const sheets = await read(file);
      const rows = sheets[0]?.data || [];
      const expected = [
        "销售日期",
        "渠道",
        "店铺",
        "订单号",
        "商品及数量",
        "商品实收金额",
        "提成比例",
        "结算月份",
        "备注",
      ];
      if (expected.some((h, i) => rows[0]?.[i] !== h))
        throw new Error("表头不匹配，请先下载导入模板");
      const records = rows
        .slice(1)
        .filter((row) => row.some((v) => v != null && v !== ""));
      if (!records.length || records.length > 500)
        throw new Error("每次导入1至500条");
      setImportRows(
        records.map((row) => ({
          date:
            row[0] instanceof Date
              ? dayjs(row[0]).format("YYYY-MM-DD")
              : String(row[0] || ""),
          channel: row[1],
          shop: row[2],
          orderNo: row[3] == null ? "" : String(row[3]),
          items: row[4],
          received: row[5],
          rate: row[6] == null || row[6] === "" ? undefined : row[6],
          period: String(row[7] || ""),
          remark: row[8] || "",
          salesperson: row[9] || user?.name || user?.username,
          basisConfirmed: true,
        })),
      );
      setImportConfirmed(false);
    } catch (e: any) {
      message.error(e.message);
    }
    return false;
  };
  const template = async () => {
    try {
      const { default: write } = await import("write-excel-file/browser");
      await write([
        [
          "销售日期",
          "渠道",
          "店铺",
          "订单号",
          "商品及数量",
          "商品实收金额",
          "提成比例",
          "结算月份",
          "备注",
          "销售人员",
        ].map((value) => ({ value, type: String })),
      ]).toFile("商品销售导入模板.xlsx");
    } catch (e: any) {
      message.error(e.message || "模板下载失败");
    }
  };
  const amountCols = [
    "online",
    "offline",
    "product",
    "lesson",
    "salary",
    "reimbursement",
    "adjustment",
    "total",
  ].map((key, i) => ({
    title: [
      "线上提成",
      "线下提成",
      "商品提成",
      "课时费",
      "工资",
      "报销",
      "调整",
      "应发合计",
    ][i],
    dataIndex: key,
    key,
    width: 100,
    align: "right" as const,
    render: (v: number) => (
      <span className={key === "total" ? styles.total : undefined}>
        {money(v)}
      </span>
    ),
  }));
  const columns = [
    { title: "姓名", dataIndex: "person", fixed: "left" as const, width: 110 },
    ...amountCols,
    {
      title: "审核",
      dataIndex: "audit",
      width: 90,
      render: (v: string, r: BonusSummary) => (
        <Tag color={v === "confirmed" ? "green" : "gold"}>
          {r.legacy ? "历史结清" : v === "confirmed" ? "已确认" : "待审核"}
        </Tag>
      ),
    },
    {
      title: "发放",
      dataIndex: "payout",
      width: 90,
      render: (v: string) => (
        <Tag color={v === "paid" ? "green" : "default"}>
          {v === "paid" ? "已发放" : "未发放"}
        </Tag>
      ),
    },
  ];
  const detailColumns = sortableColumns<BonusDetail>([
    { title: "日期", dataIndex: "date", width: 110 },
    {
      title: "类型",
      dataIndex: "type",
      sorter: (a, b) => compareTableValues(kinds[a.type], kinds[b.type]),
      render: (v: string) => kinds[v],
    },
    { title: "内容", dataIndex: "title", width: 230 },
    {
      title: "姓名",
      dataIndex: "memberName",
      width: 110,
      render: (v?: string) => v || "—",
    },
    {
      title: "实收金额",
      dataIndex: "base",
      width: 115,
      align: "right" as const,
      render: (v?: number) => (v == null ? "—" : money(v)),
    },
    {
      title: "奖励比例",
      dataIndex: "rate",
      width: 100,
      align: "right" as const,
      render: (v?: number) => (v == null ? "—" : `${v}%`),
    },
    {
      title: "金额",
      dataIndex: "amount",
      align: "right" as const,
      render: money,
    },
  ]);
  const entryColumns = ["salary", "reimbursement"].includes(tab)
    ? [
        { title: "日期", dataIndex: "date" },
        { title: "归属人员", dataIndex: "person" },
        {
          title: tab === "salary" ? "工资说明" : "报销事项",
          dataIndex: "subject",
        },
        {
          title: tab === "salary" ? "工资金额" : "报销金额",
          dataIndex: "amount",
          render: money,
        },
        {
          title: "截图凭证",
          render: (_: any, r: any) =>
            r.voucherFiles?.length ? (
              <Space wrap>
                {r.voucherFiles.map((f: any) => (
                  <a
                    key={f.filename}
                    href={f.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {f.name || "查看截图"}
                  </a>
                ))}
              </Space>
            ) : (
              r.voucher || "—"
            ),
        },
        { title: "登记人", dataIndex: "creatorName" },
        { title: "备注", dataIndex: "remark" },
      ]
    : tab === "product"
      ? [
          { title: "销售日期", dataIndex: "date" },
          { title: "渠道", dataIndex: "channel" },
          { title: "销售人员", dataIndex: "salesperson" },
          { title: "订单号", dataIndex: "orderNo" },
          { title: "商品及数量", dataIndex: "items" },
          { title: "实收", dataIndex: "received", render: money },
          { title: "比例", dataIndex: "rate", render: (v: number) => `${v}%` },
          { title: "提成", dataIndex: "amount", render: money },
          { title: "登记人", dataIndex: "creatorName" },
          { title: "归属", dataIndex: "person" },
        ]
      : [
          { title: "上课日期", dataIndex: "date" },
          { title: "课程/班级", dataIndex: "course" },
          { title: "授课人", dataIndex: "person" },
          { title: "节数", dataIndex: "sessions" },
          { title: "每节金额", dataIndex: "unit", render: money },
          { title: "课时费", dataIndex: "amount", render: money },
          { title: "调整原因", dataIndex: "reason" },
        ];
  const entryActions = {
    title: "操作",
    key: "actions",
    render: (_: any, r: any) => {
      const locked = data.rows.some(
        (s) => s.person === r.person && s.audit === "confirmed",
      );
      return (
        <Space>
          <Button
            type="link"
            size="small"
            disabled={locked}
            onClick={() => open(r.kind, r)}
          >
            编辑
          </Button>
          <Popconfirm
            title="删除这条未确认登记？"
            onConfirm={() => execute({ action: "delete", id: r.id })}
          >
            <Button type="link" danger size="small" disabled={locked}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      );
    },
  };
  return (
    <ConfigProvider theme={{ token: { colorPrimary: "#70408b" } }}>
      <div className={styles.page}>
        <div className={styles.header}>
          <div>
            <Typography.Title level={3} style={{ margin: 0 }}>
              奖金提成
            </Typography.Title>
            <Typography.Text type="secondary">
              课程提成 · 商品团队提成 · 课时费
            </Typography.Text>
          </div>
          <Space wrap>
            {data.admin && (
              <Button
                icon={<SettingOutlined />}
                onClick={() => open("standard")}
              >
                标准设置
              </Button>
            )}
            <Dropdown
              menu={{
                items: [
                  { key: "filtered", label: "导出当前筛选结算单" },
                  { key: "all", label: "导出本月全部结算单" },
                ],
                onClick: ({ key }) =>
                  void exportFile(key === "all" ? data.rows : filtered),
              }}
            >
              <Button icon={<DownloadOutlined />} loading={exporting}>
                导出结算单
              </Button>
            </Dropdown>
            <Dropdown
              menu={{
                items: [
                  { key: "product", label: "商品销售登记" },
                  { key: "lesson", label: "课时费登记" },
                  { key: "reimbursement", label: "报销" },
                  { key: "salary", label: "工资" },
                  { key: "import", label: "商品订单导入" },
                  ...(data.admin
                    ? [{ key: "adjustment", label: "结算调整" }]
                    : []),
                ],
                onClick: ({ key }) => open(key),
              }}
            >
              <Button type="primary" icon={<PlusOutlined />}>
                新增登记
              </Button>
            </Dropdown>
          </Space>
        </div>
        {error && (
          <Alert
            type="error"
            showIcon
            message="结算数据加载失败"
            description={error}
            action={<Button onClick={load}>重试</Button>}
          />
        )}
        <div className={styles.metrics}>
          {[
            ["本月应发", `¥${money(totals.total)}`],
            ["待审核", `${totals.pending}人`],
            ["待发放", `¥${money(totals.unpaid)}`],
            ["已发放", `¥${money(totals.paid)}`],
          ].map(([label, value]) => (
            <div key={label}>
              <span>
                {label}
                {label === "待发放" && <small>（含待审核）</small>}
              </span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        <Tabs
          activeKey={tab}
          onChange={setTab}
          items={[
            { key: "monthly", label: "月度结算" },
            { key: "course", label: "课程提成" },
            { key: "product", label: "商品销售" },
            { key: "lesson", label: "课时费登记" },
            { key: "reimbursement", label: "报销登记" },
            { key: "salary", label: "工资登记" },
          ]}
        />
        {tab === "course" ? (
          <CourseCommissionDetails />
        ) : (
          <>
            <div className={styles.filters}>
              <span>月份</span>
              <DatePicker
                picker="month"
                allowClear={false}
                value={dayjs(period)}
                onChange={(v) => v && setPeriod(v.format("YYYY-MM"))}
              />
              <Select
                placeholder="全部人员"
                allowClear
                value={person}
                onChange={setPerson}
                options={data.rows.map((r) => ({
                  value: r.person,
                  label: r.person,
                }))}
                style={{ minWidth: 140 }}
              />
              {tab === "monthly" && (
                <>
                  <Select
                    value={audit}
                    onChange={setAudit}
                    options={[
                      { value: "all", label: "全部审核状态" },
                      { value: "pending", label: "待审核" },
                      { value: "confirmed", label: "已确认" },
                    ]}
                  />
                  <Select
                    value={payout}
                    onChange={setPayout}
                    options={[
                      { value: "all", label: "全部发放状态" },
                      { value: "unpaid", label: "未发放" },
                      { value: "paid", label: "已发放" },
                    ]}
                  />
                </>
              )}
              <Input.Search
                placeholder="搜索姓名"
                allowClear
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: 190 }}
              />
            </div>
            <Spin spinning={loading}>
              {tab === "monthly" ? (
                <div className={styles.workspace}>
                  <div className={styles.main}>
                    <Card
                      title="月度结算"
                      extra={
                        <Typography.Text type="secondary">
                          共{filtered.length}人
                        </Typography.Text>
                      }
                    >
                      <Table<BonusSummary>
                        rowKey="person"
                        columns={sortableColumns<BonusSummary>(columns)}
                        dataSource={filtered}
                        size="middle"
                        scroll={{ x: 1100 }}
                        pagination={{
                          defaultPageSize: 10,
                          showSizeChanger: true,
                          pageSizeOptions: [10, 20, 50, 100],
                          showTotal: (total) => `共 ${total} 人`,
                        }}
                        onRow={(r) => ({
                          onClick: () => setSelected(r.person),
                          style: { cursor: "pointer" },
                        })}
                        rowClassName={(r) =>
                          r.person === current?.person ? styles.selected : ""
                        }
                        summary={(rows) => (
                          <Table.Summary.Row>
                            <Table.Summary.Cell index={0}>
                              合计
                            </Table.Summary.Cell>
                            {[
                              "online",
                              "offline",
                              "product",
                              "lesson",
                              "salary",
                              "reimbursement",
                              "adjustment",
                              "total",
                            ].map((k, i) => (
                              <Table.Summary.Cell
                                index={i + 1}
                                key={k}
                                align="right"
                              >
                                {money(
                                  rows.reduce(
                                    (n, r) =>
                                      n + Number(r[k as keyof BonusSummary]),
                                    0,
                                  ),
                                )}
                              </Table.Summary.Cell>
                            ))}
                            <Table.Summary.Cell index={9} />
                            <Table.Summary.Cell index={10} />
                          </Table.Summary.Row>
                        )}
                      />
                      <Typography.Text type="secondary">
                        商品团队提成统一归伊琳 · 伊娃老师不参与课程提成
                      </Typography.Text>
                    </Card>
                    <Card
                      title={
                        current
                          ? `${current.person} · 明细与变更记录`
                          : "明细与变更记录"
                      }
                      className={styles.records}
                    >
                      <Tabs
                        items={[
                          {
                            key: "detail",
                            label: "结算明细",
                            children: (
                              <Table<BonusDetail>
                                rowKey={(r) => `${r.type}-${r.id}`}
                                size="small"
                                columns={detailColumns}
                                dataSource={current?.details || []}
                                key={`${period}-${current?.person || ""}`}
                                pagination={{
                                  ...detailPagination,
                                  showSizeChanger: true,
                                  pageSizeOptions: [6, 10, 20, 50, 100],
                                  showTotal: (total) => `共 ${total} 条`,
                                }}
                                onChange={(page, _filters, _sorter, extra) =>
                                  setDetailPagination((prev) => ({
                                    current:
                                      extra.action === "sort" ||
                                      page.pageSize !== prev.pageSize
                                        ? 1
                                        : page.current || 1,
                                    pageSize: page.pageSize || prev.pageSize,
                                  }))
                                }
                                scroll={{ x: 1000 }}
                              />
                            ),
                          },
                          {
                            key: "adjust",
                            label: "调整记录",
                            children: (
                              <Table
                                rowKey="id"
                                size="small"
                                columns={[
                                  { title: "日期", dataIndex: "date" },
                                  {
                                    title: "金额",
                                    dataIndex: "amount",
                                    render: money,
                                  },
                                  { title: "原因", dataIndex: "reason" },
                                  { title: "登记人", dataIndex: "creatorName" },
                                  {
                                    title: "操作",
                                    render: (_: any, r: any) => (
                                      <Button
                                        type="link"
                                        disabled={
                                          current?.audit === "confirmed" ||
                                          !data.admin
                                        }
                                        onClick={() => open("adjustment", r)}
                                      >
                                        编辑
                                      </Button>
                                    ),
                                  },
                                ]}
                                dataSource={data.entries.filter(
                                  (e) =>
                                    e.kind === "adjustment" &&
                                    e.person === current?.person,
                                )}
                                pagination={{
                                  defaultPageSize: 6,
                                  showSizeChanger: true,
                                  pageSizeOptions: [6, 10, 20, 50, 100],
                                }}
                              />
                            ),
                          },
                          {
                            key: "log",
                            label: "操作记录",
                            children: (
                              <Table
                                rowKey="id"
                                size="small"
                                columns={[
                                  {
                                    title: "时间",
                                    dataIndex: "createdAt",
                                    render: (v: string) =>
                                      dayjs(v).format("YYYY-MM-DD HH:mm"),
                                  },
                                  { title: "操作", dataIndex: "action" },
                                  { title: "操作人", dataIndex: "actor" },
                                  {
                                    title: "详情",
                                    render: (_: any, r: any) => (
                                      <Button
                                        type="link"
                                        onClick={() =>
                                          Modal.info({
                                            title: r.action,
                                            content: (
                                              <pre
                                                style={{
                                                  whiteSpace: "pre-wrap",
                                                  maxHeight: 400,
                                                  overflow: "auto",
                                                }}
                                              >
                                                {JSON.stringify(
                                                  JSON.parse(r.detail),
                                                  null,
                                                  2,
                                                )}
                                              </pre>
                                            ),
                                          })
                                        }
                                      >
                                        查看
                                      </Button>
                                    ),
                                  },
                                ]}
                                dataSource={data.logs.filter(
                                  (l) => l.person === current?.person,
                                )}
                                pagination={{
                                  defaultPageSize: 6,
                                  showSizeChanger: true,
                                  pageSizeOptions: [6, 10, 20, 50, 100],
                                }}
                              />
                            ),
                          },
                        ]}
                      />
                      <Typography.Text type="secondary">
                        未确认记录可修正；确认后保留明细与当时标准。
                      </Typography.Text>
                    </Card>
                  </div>
                  <Card className={styles.detail}>
                    {current ? (
                      <>
                        <div className={styles.personTitle}>
                          <strong>
                            {current.person} · {period}
                          </strong>
                          <Space>
                            <Tag
                              color={
                                current.audit === "confirmed" ? "green" : "gold"
                              }
                            >
                              {current.legacy
                                ? "历史结清"
                                : current.audit === "confirmed"
                                  ? "已确认"
                                  : "待审核"}
                            </Tag>
                            <Tag>
                              {current.payout === "paid" ? "已发放" : "未发放"}
                            </Tag>
                          </Space>
                        </div>
                        <div className={styles.due}>
                          <span>应发合计</span>
                          <strong>¥{money(current.total)}</strong>
                        </div>
                        <section>
                          <h4>
                            课程提成{" "}
                            <b>¥{money(current.online + current.offline)}</b>
                          </h4>
                          <div className={styles.line}>
                            <span>线上课程提成</span>
                            <span>¥{money(current.online)}</span>
                          </div>
                          <div className={styles.line}>
                            <span>线下课程提成</span>
                            <span>¥{money(current.offline)}</span>
                          </div>
                        </section>
                        <section>
                          <h4>
                            商品团队提成 <b>¥{money(current.product)}</b>
                          </h4>
                          {current.details.some((d) => d.type === "product") ? (
                            <Table
                              size="small"
                              rowKey="channel"
                              pagination={false}
                              columns={[
                                { title: "渠道", dataIndex: "channel" },
                                {
                                  title: "实收",
                                  dataIndex: "base",
                                  align: "right",
                                  render: money,
                                },
                                {
                                  title: "提成",
                                  dataIndex: "amount",
                                  align: "right",
                                  render: money,
                                },
                              ]}
                              dataSource={channels.map((channel) => ({
                                channel,
                                base: current.details
                                  .filter((d) => d.channel === channel)
                                  .reduce((n, d) => n + (d.base || 0), 0),
                                amount: current.details
                                  .filter((d) => d.channel === channel)
                                  .reduce((n, d) => n + d.amount, 0),
                              }))}
                            />
                          ) : (
                            <Typography.Text type="secondary">
                              无商品提成
                            </Typography.Text>
                          )}
                          <p className={styles.hint}>
                            按每笔记录比例计提 · 统一归属伊琳
                          </p>
                        </section>
                        <section>
                          <h4>
                            课时费 <b>¥{money(current.lesson)}</b>
                          </h4>
                          {current.details
                            .filter((d) => d.type === "lesson")
                            .map((d) => (
                              <div className={styles.lesson} key={d.id}>
                                <span>
                                  {d.date} · {d.title}
                                </span>
                                <span>
                                  {d.sessions}节 × ¥{money(d.unit)} = ¥
                                  {money(d.amount)}
                                </span>
                                {d.reason && (
                                  <small>调整原因：{d.reason}</small>
                                )}
                              </div>
                            ))}
                          <p className={styles.hint}>
                            登记人即授课人；不同单价分行登记。
                          </p>
                        </section>
                        {(["salary", "reimbursement"] as const).map((kind) => (
                          <section key={kind}>
                            <h4>
                              {kinds[kind]} <b>¥{money(current[kind] || 0)}</b>
                            </h4>
                            {current.details
                              .filter((d) => d.type === kind)
                              .map((d) => (
                                <div className={styles.lesson} key={d.id}>
                                  <span>
                                    {d.date} · {d.title}
                                  </span>
                                  <span>¥{money(d.amount)}</span>
                                  {d.voucher && (
                                    <small>凭证：{d.voucher}</small>
                                  )}
                                  {data.admin &&
                                    current.audit === "pending" && (
                                      <Button
                                        type="link"
                                        size="small"
                                        onClick={() =>
                                          open(
                                            kind,
                                            data.entries.find(
                                              (e) => e.id === d.id,
                                            ),
                                          )
                                        }
                                      >
                                        编辑登记
                                      </Button>
                                    )}
                                </div>
                              ))}
                          </section>
                        ))}
                        <section>
                          <div className={styles.line}>
                            <strong>调整金额</strong>
                            <span>¥{money(current.adjustment)}</span>
                            {data.admin && current.audit === "pending" && (
                              <Button
                                type="link"
                                size="small"
                                onClick={() => open("adjustment")}
                              >
                                添加调整
                              </Button>
                            )}
                          </div>
                        </section>
                        {current.legacy ? (
                          <Alert
                            type="info"
                            message="历史结清记录沿用原状态"
                            description="历史课程记录未生成新版快照，不重复生成财务支出。"
                          />
                        ) : (
                          <>
                            <Space wrap>
                              <Popconfirm
                                title="确认本月结算？"
                                description="将保存当前明细与标准，确认后不可覆盖修改。"
                                onConfirm={() =>
                                  execute({
                                    action: "confirm",
                                    period,
                                    person: current.person,
                                    expectedSnapshot: JSON.stringify(current),
                                  })
                                }
                              >
                                <Button
                                  type="primary"
                                  disabled={
                                    !data.canReview ||
                                    current.audit === "confirmed"
                                  }
                                  loading={saving}
                                >
                                  审核确认
                                </Button>
                              </Popconfirm>
                              <Button
                                disabled={
                                  !data.canPay ||
                                  current.audit !== "confirmed" ||
                                  current.payout === "paid"
                                }
                                onClick={() => open("pay")}
                              >
                                标记发放
                              </Button>
                            </Space>
                            <p className={styles.hint}>
                              审核：李雷／伊琳；发放：李雷。确认后可标记发放，并记录财务支出。
                            </p>
                          </>
                        )}
                        <Descriptions
                          size="small"
                          column={1}
                          items={[
                            {
                              key: "review",
                              label: "审核人",
                              children: current.reviewedBy || "—",
                            },
                            {
                              key: "reviewAt",
                              label: "审核时间",
                              children: current.reviewedAt
                                ? dayjs(current.reviewedAt).format(
                                    "YYYY-MM-DD HH:mm",
                                  )
                                : "—",
                            },
                            {
                              key: "paid",
                              label: "发放日期",
                              children: current.paidAt || "—",
                            },
                            {
                              key: "voucher",
                              label: "发放凭证",
                              children: current.voucher || "—",
                            },
                          ]}
                        />
                      </>
                    ) : (
                      <Empty description="请选择有结算记录的人员" />
                    )}
                  </Card>
                </div>
              ) : (
                <Card
                  title={
                    tab === "product"
                      ? "商品销售登记"
                      : tab === "lesson"
                        ? "课时费登记"
                        : `${kinds[tab]}登记`
                  }
                  extra={
                    <Space>
                      {tab === "product" && (
                        <Button onClick={() => open("import")}>导入订单</Button>
                      )}
                      <Button type="primary" onClick={() => open(tab)}>
                        新增登记
                      </Button>
                    </Space>
                  }
                >
                  <Table
                    rowKey="id"
                    size="small"
                    columns={sortableColumns<any>([
                      ...entryColumns,
                      entryActions,
                    ])}
                    dataSource={data.entries.filter(
                      (e) =>
                        e.kind === tab &&
                        (!person || e.person === person) &&
                        (!search ||
                          e.person.includes(search) ||
                          e.creatorName?.includes(search)),
                    )}
                    scroll={{ x: 1200 }}
                    pagination={{
                      defaultPageSize: 20,
                      showSizeChanger: true,
                      pageSizeOptions: [10, 20, 50, 100],
                    }}
                  />
                </Card>
              )}
            </Spin>
          </>
        )}
        <Alert
          className={styles.notice}
          showIcon
          type="warning"
          message="待确认口径：退款冲减、运费及平台扣费、结算月份。"
          description="商品登记需人工核对计提基数与结算月份；退款及取消订单暂不计提。"
        />
        <Modal
          title={
            modal === "standard"
              ? "默认标准与生效日期"
              : modal === "pay"
                ? "标记发放"
                : modal === "import"
                  ? "商品订单导入"
                  : `${editing ? "编辑" : "新增"}${kinds[modal] || ""}登记`
          }
          open={!!modal}
          onCancel={() => {
            if (!uploading && !saving) setModal("");
          }}
          closable={!uploading && !saving}
          maskClosable={!uploading && !saving}
          onOk={
            modal === "import"
              ? async () => {
                  setSaving(true);
                  try {
                    const result = await request({
                      action: "import",
                      rows: importRows,
                    });
                    message.success(
                      `新增${result.result.created}条，更新${result.result.updated}条`,
                    );
                    setModal("");
                    setImportRows([]);
                    await load();
                  } catch (e: any) {
                    message.error(e.response?.data?.error || e.message);
                  } finally {
                    setSaving(false);
                  }
                }
              : save
          }
          confirmLoading={saving}
          okButtonProps={{
            disabled:
              uploading > 0 ||
              saving ||
              (modal === "import" && (!importRows.length || !importConfirmed)),
          }}
          width={modal === "import" ? 900 : 620}
          destroyOnHidden
        >
          {modal === "import" ? (
            <Space direction="vertical" style={{ width: "100%" }}>
              <Alert
                type="info"
                message="按渠道、店铺、订单号更新重复订单；已确认月份拒绝覆盖。导入失败时整批不保存。"
              />
              <Button onClick={template}>下载模板</Button>
              <Upload accept=".xlsx" beforeUpload={readImport} maxCount={1}>
                <Button>选择Excel文件</Button>
              </Upload>
              <Table
                rowKey={(_, i) => String(i)}
                size="small"
                columns={[
                  { title: "日期", dataIndex: "date" },
                  { title: "渠道", dataIndex: "channel" },
                  { title: "店铺", dataIndex: "shop" },
                  { title: "订单号", dataIndex: "orderNo" },
                  { title: "实收", dataIndex: "received" },
                  { title: "比例", dataIndex: "rate" },
                  { title: "结算月份", dataIndex: "period" },
                ]}
                dataSource={importRows}
                pagination={{ pageSize: 5 }}
              />
              <Checkbox
                checked={importConfirmed}
                onChange={(e) => setImportConfirmed(e.target.checked)}
              >
                已核对各行计提基数及结算月份（表格导入不扣商城库存）
              </Checkbox>
            </Space>
          ) : (
            <Form form={form} layout="vertical" data-enter-submit="off" onKeyDown={event=>{
              if(event.key === "Enter" && (event.target as HTMLElement).tagName !== "BUTTON") {
                event.stopPropagation();
                if((event.target as HTMLElement).tagName !== "TEXTAREA") event.preventDefault();
              }
            }}>
              {modal === "standard" ? (
                <>
                  <Alert
                    message="新标准按销售日期、上课日期匹配；已登记金额及已确认结算保持原标准。"
                    type="info"
                  />
                  <Form.Item
                    label="生效日期"
                    name="effectiveDate"
                    rules={[{ required: true }]}
                  >
                    <DatePicker allowClear={false} />
                  </Form.Item>
                  <Form.Item
                    label="默认商品提成比例（%）"
                    name="productRate"
                    rules={[{ required: true }]}
                  >
                    <InputNumber min={0} max={100} precision={2} />
                  </Form.Item>
                  <Form.Item label="默认每节课时费（选填）" name="lessonUnit">
                    <InputNumber min={0} precision={2} />
                  </Form.Item>
                  <Table
                    rowKey="id"
                    size="small"
                    pagination={false}
                    columns={[
                      { title: "生效日期", dataIndex: "effectiveDate" },
                      {
                        title: "商品比例",
                        dataIndex: "productRate",
                        render: (v: number) => `${v}%`,
                      },
                      {
                        title: "每节金额",
                        dataIndex: "lessonUnit",
                        render: (v: number | null) =>
                          v == null ? "未设定" : money(v),
                      },
                      { title: "操作人", dataIndex: "actor" },
                    ]}
                    dataSource={data.standards}
                  />
                </>
              ) : modal === "pay" ? (
                <>
                  <Alert
                    type="info"
                    message={`将按确认快照发放 ¥${money(current?.total)}，并生成一笔财务支出。`}
                  />
                  <Form.Item
                    name="paidDate"
                    label="实际发放日期"
                    rules={[{ required: true }]}
                  >
                    <DatePicker />
                  </Form.Item>
                  <Form.Item
                    name="voucher"
                    label="发放凭证说明／银行流水编号"
                    rules={[{ required: true }]}
                  >
                    <Input.TextArea maxLength={1000} />
                  </Form.Item>
                </>
              ) : (
                <>
                  <Space wrap>
                    <Form.Item
                      label={
                        modal === "lesson"
                          ? "上课日期"
                          : modal === "salary"
                            ? "工资日期"
                            : modal === "reimbursement"
                              ? "报销日期"
                              : modal === "product"
                                ? "销售日期"
                                : "调整日期"
                      }
                      name="date"
                      rules={[{ required: true }]}
                    >
                      <DatePicker
                        allowClear={false}
                        onChange={(v) => {
                          if (v && modal === "product")
                            form.setFieldValue("period", v.startOf("month"));
                          if (!editing && v) {
                            const s = data.standards.find(
                              (s) => s.effectiveDate <= v.format("YYYY-MM-DD"),
                            );
                            form.setFieldsValue({
                              rate: s?.productRate ?? 25,
                              unit: s?.lessonUnit,
                            });
                          }
                        }}
                      />
                    </Form.Item>
                    <Form.Item
                      label="结算月份"
                      name="period"
                      rules={[{ required: true }]}
                    >
                      <DatePicker picker="month" allowClear={false} />
                    </Form.Item>
                  </Space>
                  {modal === "product" ? (
                    <>
                      <Alert
                        type="info"
                        message="结算归属固定伊琳，登记人由当前账号记录。"
                      />
                      <Space wrap>
                        <Form.Item
                          label="渠道"
                          name="channel"
                          rules={[{ required: true }]}
                        >
                          <Select
                            options={channels.map((value) => ({
                              value,
                              label: value,
                            }))}
                            style={{ width: 150 }}
                          />
                        </Form.Item>
                      </Space>
                      <Form.Item
                        label="订单号／线下编号（线下留空自动生成）"
                        name="orderNo"
                      >
                        <Input maxLength={1000} />
                      </Form.Item>
                      <Form.Item name="requestKey" hidden>
                        <Input />
                      </Form.Item>
                      <Form.List
                        name="productLines"
                        rules={[
                          {
                            validator: (_, v) =>
                              v?.length
                                ? Promise.resolve()
                                : Promise.reject(new Error("请选择商品")),
                          },
                        ]}
                      >
                        {(fields, { add, remove }, { errors }) => (
                          <>
                            {fields.map((field) => (
                              <Space key={field.key} align="start" wrap>
                                <Form.Item
                                  label="商城商品／规格"
                                  name={[field.name, "productId"]}
                                  rules={[
                                    {
                                      required: true,
                                      message: "请选择商品和规格",
                                    },
                                  ]}
                                >
                                  <Select
                                    showSearch
                                    optionFilterProp="label"
                                    style={{ width: 320 }}
                                    placeholder="搜索商品、规格、颜色或尺码"
                                    options={data.products.map((p) => ({
                                      value: p.id,
                                      label: [
                                        p.name,
                                        p.spec,
                                        p.size,
                                        p.color,
                                        `库存 ${p.stock}`,
                                      ]
                                        .filter(Boolean)
                                        .join(" · "),
                                    }))}
                                  />
                                </Form.Item>
                                <Form.Item
                                  label="数量"
                                  name={[field.name, "quantity"]}
                                  rules={[{ required: true }]}
                                >
                                  <InputNumber
                                    min={1}
                                    max={100000}
                                    precision={0}
                                  />
                                </Form.Item>
                                <Button
                                  style={{ marginTop: 30 }}
                                  onClick={() => remove(field.name)}
                                >
                                  移除
                                </Button>
                              </Space>
                            ))}
                            <Button
                              onClick={() => add({ quantity: 1 })}
                              icon={<PlusOutlined />}
                            >
                              添加商品
                            </Button>
                            <Form.ErrorList errors={errors} />
                          </>
                        )}
                      </Form.List>
                      <p className={styles.hint}>
                        保存时按规格扣减商城库存；修改数量只扣减差额，删除未确认登记会回补库存。
                      </p>
                      <Form.Item
                        label="销售人员"
                        name="salesperson"
                        rules={[{ required: true, message: "请选择销售人员" }]}
                      >
                        <AutoComplete
                          placeholder="搜索或填写销售人员"
                          options={data.salespeople.map((p) => ({
                            value: p.name,
                          }))}
                          filterOption={(v, o) =>
                            String(o?.value || "")
                              .toLowerCase()
                              .includes(v.toLowerCase())
                          }
                        />
                      </Form.Item>
                      <Space wrap>
                        <Form.Item
                          label="商品实收金额"
                          name="received"
                          rules={[{ required: true }]}
                        >
                          <InputNumber min={0} precision={2} />
                        </Form.Item>
                        <Form.Item
                          label="提成比例（%）"
                          name="rate"
                          rules={[{ required: true }]}
                        >
                          <InputNumber min={0} max={100} precision={2} />
                        </Form.Item>
                      </Space>
                      <p>
                        自动计提：¥
                        {money(
                          Math.round(
                            Number(received || 0) * Number(rate || 0),
                          ) / 100,
                        )}
                      </p>

                      <Form.Item label="收款凭证说明／流水编号" name="voucher">
                        <Input.TextArea maxLength={1000} />
                      </Form.Item>
                      <Form.Item
                        name="basisConfirmed"
                        valuePropName="checked"
                        rules={[
                          {
                            validator: (_, v) =>
                              v
                                ? Promise.resolve()
                                : Promise.reject(
                                    new Error("请核对计提基数与结算月份"),
                                  ),
                          },
                        ]}
                      >
                        <Checkbox>已核对实收计提基数及结算月份</Checkbox>
                      </Form.Item>
                    </>
                  ) : modal === "lesson" ? (
                    <>
                      <Alert
                        type="info"
                        message={`登记人即授课及收款归属人：${editing?.person || user?.name || user?.username || "当前账号"}`}
                        description="相同单价可登记多节，不同单价请分行登记。"
                      />
                      <Form.Item
                        label="线下课程"
                        name="courseGroup"
                        rules={[
                          { required: true, message: "请搜索并选择线下课程" },
                        ]}
                      >
                        <Select
                          showSearch
                          optionFilterProp="label"
                          placeholder="输入课程名称模糊搜索"
                          options={[
                            ...new Set(data.courses.map((c) => c.name)),
                          ].map((name) => ({ value: name, label: name }))}
                          onChange={() =>
                            form.setFieldValue("courseId", undefined)
                          }
                        />
                      </Form.Item>
                      <Form.Item
                        label="课程期次"
                        name="courseId"
                        rules={[{ required: true, message: "请选择期次" }]}
                      >
                        <Select
                          showSearch
                          optionFilterProp="label"
                          disabled={!courseGroup}
                          placeholder="选择具体期次"
                          options={data.courses
                            .filter((c) => c.name === courseGroup)
                            .map((c) => ({
                              value: c.id,
                              label: [
                                c.subType || "未标记期次",
                                c.startDate,
                                c.endDate,
                                `#${c.id}`,
                              ]
                                .filter(Boolean)
                                .join(" · "),
                            }))}
                        />
                      </Form.Item>
                      <Space wrap>
                        <Form.Item
                          label="节数"
                          name="sessions"
                          rules={[{ required: true }]}
                        >
                          <InputNumber min={1} max={1000} precision={0} />
                        </Form.Item>
                        <Form.Item
                          label="每节金额"
                          name="unit"
                          rules={[{ required: true }]}
                        >
                          <InputNumber min={0} precision={2} />
                        </Form.Item>
                      </Space>
                      <p>
                        自动合计：¥
                        {money(Number(sessions || 0) * Number(unit || 0))}
                      </p>
                      <p className={styles.hint}>
                        当日标准：
                        {standard?.lessonUnit == null
                          ? "未设置默认单价"
                          : `¥${money(standard.lessonUnit)}/节`}
                      </p>
                      <Form.Item label="金额调整／重复登记原因" name="reason">
                        <Input maxLength={1000} />
                      </Form.Item>
                      <Form.Item
                        name="duplicateConfirmed"
                        valuePropName="checked"
                      >
                        <Checkbox>
                          如出现同一期次同一天重复，已核对并填写原因
                        </Checkbox>
                      </Form.Item>
                    </>
                  ) : ["salary", "reimbursement"].includes(modal) ? (
                    <>
                      <Alert
                        type="info"
                        message={
                          modal === "salary"
                            ? "按登记金额计入工资，不自动计算扣税或扣款。"
                            : "报销金额计入本月应发，审核确认后统一发放。"
                        }
                      />
                      {data.admin ? (
                        <Form.Item
                          label="归属人员"
                          name="person"
                          rules={[{ required: true }]}
                        >
                          <AutoComplete
                            placeholder="选择或填写人员"
                            options={data.rows.map((r) => ({
                              value: r.person,
                              label: r.person,
                            }))}
                          />
                        </Form.Item>
                      ) : (
                        <p>
                          {modal === "salary" ? "工资归属：" : "报销归属："}
                          {editing?.person || user?.name || user?.username}
                        </p>
                      )}
                      <Form.Item
                        label={modal === "salary" ? "工资说明" : "报销事项"}
                        name="subject"
                        rules={[{ required: true }]}
                      >
                        <Input maxLength={1000} />
                      </Form.Item>
                      <Form.Item
                        label={modal === "salary" ? "工资金额" : "报销金额"}
                        name="amount"
                        rules={[{ required: true }]}
                      >
                        <InputNumber min={0.01} precision={2} />
                      </Form.Item>
                      {modal === "reimbursement" ? (
                        <>
                          <Form.Item label="报销截图凭证" required>
                            <Upload
                              accept="image/jpeg,image/png,image/webp"
                              listType="picture"
                              maxCount={12}
                              multiple
                              fileList={voucherFiles.map((f: any) => ({
                                uid: f.filename,
                                name: f.name,
                                url: f.url,
                                status: "done",
                              }))}
                              beforeUpload={(file) => {
                                if (
                                  ![
                                    "image/jpeg",
                                    "image/png",
                                    "image/webp",
                                  ].includes(file.type) ||
                                  file.size > 12 * 1024 * 1024
                                ) {
                                  message.error(
                                    "请选择12MB以内的JPG、PNG或WebP截图",
                                  );
                                  return Upload.LIST_IGNORE;
                                }
                                return true;
                              }}
                              customRequest={async ({
                                file,
                                onSuccess,
                                onError,
                              }: any) => {
                                setUploading((n) => n + 1);
                                try {
                                  const body = new FormData();
                                  body.append("file", file);
                                  const result = await api.post(
                                    "/bonus-management/vouchers",
                                    body,
                                  );
                                  const files =
                                    form.getFieldValue("voucherFiles") || [];
                                  if (files.length >= 12)
                                    throw new Error("最多上传12张截图");
                                  form.setFieldValue("voucherFiles", [
                                    ...files,
                                    result.data.data,
                                  ]);
                                  onSuccess?.(result.data);
                                } catch (e: any) {
                                  message.error(
                                    e.response?.data?.error || e.message,
                                  );
                                  onError?.(e);
                                } finally {
                                  setUploading((n) => n - 1);
                                }
                              }}
                              onRemove={(f) => {
                                form.setFieldValue(
                                  "voucherFiles",
                                  voucherFiles.filter(
                                    (p: any) => p.filename !== f.uid,
                                  ),
                                );
                                return true;
                              }}
                              onPreview={(f) => {
                                if (f.url)
                                  window.open(f.url, "_blank", "noopener");
                              }}
                            >
                              <Button
                                loading={uploading > 0}
                                icon={<PlusOutlined />}
                              >
                                上传截图
                              </Button>
                            </Upload>
                            <p className={styles.hint}>
                              支持JPG、PNG、WebP，单张不超过12MB，最多12张。
                            </p>
                            {editing?.voucher &&
                              !editing?.voucherFiles?.length && (
                                <p>原凭证：{editing.voucher}</p>
                              )}
                          </Form.Item>
                          <Form.Item
                            name="voucherFiles"
                            hidden
                            rules={[
                              {
                                validator: (_, v) =>
                                  v?.length || editing?.voucher
                                    ? Promise.resolve()
                                    : Promise.reject(
                                        new Error("请上传报销截图凭证"),
                                      ),
                              },
                            ]}
                          >
                            <Input />
                          </Form.Item>
                        </>
                      ) : (
                        <Form.Item label="凭证说明／流水编号" name="voucher">
                          <Input.TextArea maxLength={1000} />
                        </Form.Item>
                      )}
                    </>
                  ) : (
                    <>
                      <Form.Item
                        label="归属人员"
                        name="person"
                        rules={[{ required: true }]}
                      >
                        <AutoComplete
                          placeholder="选择或填写归属人员，支持新月份调整"
                          options={data.rows.map((r) => ({
                            value: r.person,
                            label: r.person,
                          }))}
                        />
                      </Form.Item>
                      <Form.Item
                        label="调整金额（可为负数）"
                        name="amount"
                        rules={[{ required: true }]}
                      >
                        <InputNumber precision={2} />
                      </Form.Item>
                      <Form.Item
                        label="调整原因"
                        name="reason"
                        rules={[{ required: true }]}
                      >
                        <Input.TextArea maxLength={1000} />
                      </Form.Item>
                    </>
                  )}
                  <Form.Item label="备注" name="remark">
                    <Input.TextArea maxLength={1000} />
                  </Form.Item>
                </>
              )}
            </Form>
          )}
        </Modal>
      </div>
    </ConfigProvider>
  );
}
