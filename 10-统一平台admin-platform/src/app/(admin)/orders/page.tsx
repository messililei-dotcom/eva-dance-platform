"use client";
import { useEffect, useState } from "react";
import ExclusiveOrders from "@/components/exclusive-orders";
import styles from "./orders.module.css";
import {
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Input,
  Row,
  Select,
  Space,
  Statistic,
  Tabs,
  Tag,
  Typography,
} from "antd";
import { Table } from "@/components/adaptive-table";
import {
  DownloadOutlined,
  ReloadOutlined,
  SearchOutlined,
  ShoppingCartOutlined,
} from "@ant-design/icons";
import { platformAdapter } from "@/lib/adapters/platform";
import { formatCompactMoney, formatPaymentAmount } from "@/lib/money-format";
import { sortableColumns } from "@/lib/table-sort";
import type { UnifiedOrder } from "@/types/domain";

const { RangePicker } = DatePicker;
const { Text, Title } = Typography;

function money(value: number) {
  return formatPaymentAmount(value);
}

function orderTypeLabel(value: string) {
  const map: Record<string, string> = {
    online_course: "线上课程",
    course: "线上课程",
    lizhi: "荔枝微课",
    "offline-training": "线下课程",
    live: "直播",
    training: "线下培训",
    event: "活动",
    competition: "赛事",
    shop: "电商商品",
    membership: "学员",
    finance: "财务订单",
  };
  return map[value] || value || "-";
}

function statusColor(value: string) {
  if (["paid", "completed", "已支付", "已完成"].includes(value)) return "green";
  if (["pending", "待支付", "待付款"].includes(value)) return "orange";
  if (["refunded", "已退款"].includes(value)) return "blue";
  if (["closed", "已关闭"].includes(value)) return "default";
  return "purple";
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<UnifiedOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [types, setTypes] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [debouncedKeyword, setDebouncedKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [type, setType] = useState("all");
  const [view, setView] = useState("all");
  const [tab, setTab] = useState("all");

  const load = () => {
    setLoading(true);
    platformAdapter
      .getOrderPage({
        page,
        pageSize,
        keyword: debouncedKeyword,
        type,
        status: tab,
      })
      .then((result) => {
        setOrders(result.orders);
        setTotal(result.total);
        setSummary(result.summary);
        setTypes(result.types);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedKeyword(keyword.trim()),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [keyword]);

  useEffect(load, [page, pageSize, debouncedKeyword, type, tab]);

  const filtered = orders;

  return (
    <div className={styles.page}>
      <ExclusiveOrders
        showList={view === "exclusive"}
        renderHeader={(createAction) => (
          <div className={styles.header}>
            <div>
              <Title level={2} className={styles.title}>
                订单中心
              </Title>
              <Text type="secondary">
                统一查看课程、商品及财务订单，创建专属订单供客户支付。
              </Text>
            </div>
            <div className={styles.actions}>{createAction}</div>
          </div>
        )}
      >
        <Card className={styles.summary}>
          <Row gutter={[24, 16]}>
            <Col xs={12} md={6}>
              <Statistic
                title="全部订单"
                value={summary.total ?? total}
                prefix={<ShoppingCartOutlined />}
              />
            </Col>
            <Col xs={12} md={6}>
              <Statistic
                title="订单总额"
                value={formatCompactMoney(summary.totalAmount || 0)}
                valueStyle={{ color: "#F72A8A" }}
              />
            </Col>
            <Col xs={12} md={6}>
              <Statistic
                title="已完成"
                value={summary.completed || 0}
                valueStyle={{ color: "#22C55E" }}
              />
            </Col>
            <Col xs={12} md={6}>
              <Statistic
                title="待处理"
                value={summary.pending || 0}
                valueStyle={{ color: "#F59E0B" }}
              />
            </Col>
          </Row>
        </Card>
        <Tabs
          activeKey={view}
          onChange={setView}
          className={styles.views}
          items={[
            { key: "all", label: "全部订单" },
            { key: "exclusive", label: "专属订单" },
          ]}
        />
      </ExclusiveOrders>

      {view === "all" && (
        <Card className={styles.list} styles={{ body: { padding: 0 } }}>
          <div className={styles.toolbar}>
            <Row gutter={[12, 12]} align="middle">
              <Col xs={24} lg={9}>
                <Input
                  prefix={<SearchOutlined />}
                  placeholder="搜索订单号、学员、手机号、内容"
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  allowClear
                />
              </Col>
              <Col xs={12} md={5}>
                <Select
                  value={type}
                  onChange={(value) => {
                    setType(value);
                    setPage(1);
                  }}
                  style={{ width: "100%" }}
                  options={["all", ...types].map((item) => ({
                    value: item,
                    label: item === "all" ? "全部类型" : orderTypeLabel(item),
                  }))}
                />
              </Col>
              <Col xs={24} md={6}>
                <RangePicker style={{ width: "100%" }} />
              </Col>
              <Col xs={24} md={4} style={{ textAlign: "right" }}>
                <Space>
                  <Button icon={<ReloadOutlined />} onClick={load}>
                    刷新
                  </Button>
                  <Button icon={<DownloadOutlined />}>导出</Button>
                </Space>
              </Col>
            </Row>
          </div>

          <Tabs
            className={styles.statusTabs}
            activeKey={tab}
            onChange={(value) => {
              setTab(value);
              setPage(1);
            }}
            items={[
              { key: "all", label: `全部 ${tab === "all" ? total : ""}` },
              { key: "pending", label: "待处理" },
              { key: "paid", label: "已支付" },
              { key: "completed", label: "已完成" },
              { key: "refunded", label: "退款" },
            ]}
          />

          <Table
            rowKey="id"
            size="middle"
            loading={loading}
            dataSource={filtered}
            scroll={{ x: 1100, y: "calc(100dvh - 430px)" }}
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: true,
              showTotal: (value) => `共 ${value} 条订单`,
              onChange: (nextPage, nextSize) => {
                setPage(nextSize === pageSize ? nextPage : 1);
                setPageSize(nextSize);
              },
            }}
            locale={{ emptyText: <Empty description="暂无订单数据" /> }}
            columns={sortableColumns<UnifiedOrder>([
              {
                title: "订单号",
                dataIndex: "orderNo",
                fixed: "left",
                width: 170,
                render: (value) => <Text strong>{value}</Text>,
              },
              { title: "学员", dataIndex: "memberName", width: 130 },
              { title: "手机号", dataIndex: "memberPhone", width: 130 },
              {
                title: "类型",
                dataIndex: "orderType",
                width: 120,
                render: (value) => (
                  <Tag color="magenta">{orderTypeLabel(value)}</Tag>
                ),
              },
              { title: "内容", dataIndex: "title", ellipsis: true, width: 240 },
              {
                title: "金额",
                dataIndex: "amount",
                align: "right" as const,
                width: 120,
                render: (value) => (
                  <Text strong style={{ color: "#F72A8A" }}>
                    {money(value)}
                  </Text>
                ),
              },
              {
                title: "状态",
                dataIndex: "status",
                width: 110,
                render: (value) => (
                  <Tag color={statusColor(value)}>{value}</Tag>
                ),
              },
              { title: "来源", dataIndex: "sourceType", width: 140 },
              { title: "日期", dataIndex: "orderDate", width: 120 },
            ])}
          />
        </Card>
      )}
    </div>
  );
}
