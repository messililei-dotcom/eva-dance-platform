"use client";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  App,
  Button,
  Checkbox,
  Form,
  Input,
  Modal,
  Space,
  Table,
  Tag,
} from "antd";
import { api } from "@/lib/api";
const names: Record<string, string> = {
  pending: "待付款",
  paid: "待发货",
  shipped: "已发货",
  completed: "已收货",
  cancelled: "已取消",
  refund_requested: "申请退款",
  refunding: "退款处理中",
  refunded: "已退款",
};
type Order = {
  id: string;
  memberId: number;
  recipient: string;
  phone: string;
  address: string;
  provider: string;
  status: string;
  totalFen: number;
  createdAt: number;
  shippedAt: number;
  carrier: string;
  trackingNo: string;
  refundReason: string;
  items: { name: string; spec: string; quantity: number }[];
};
export default function ShopOnlineOrders() {
  const { message } = App.useApp();
  const [orders, setOrders] = useState<Order[]>([]),
    [total, setTotal] = useState(0),
    [page, setPage] = useState(1),
    [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false);
  const [payment, setPayment] = useState({ wechat: false, alipay: false }),
    [target, setTarget] = useState<Order | null>(null),
    [mode, setMode] = useState<"ship" | "refund">("ship"),
    [returned, setReturned] = useState(false);
  const [form] = Form.useForm();
  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        const { data } = await api.get("/ecommerce/orders", {
          params: { page },
        });
        setOrders(data.orders);
        setTotal(data.total);
        setPayment(data.payment);
      } catch (e: any) {
        if (!quiet) message.error(e.response?.data?.error || "订单读取失败");
      } finally {
        setLoading(false);
      }
    },
    [page, message],
  );
  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      if (!document.hidden) void load(true);
    }, 5000);
    return () => clearInterval(timer);
  }, [load]);
  const submit = async () => {
    if (!target) return;
    setBusy(true);
    try {
      const values = mode === "ship" ? await form.validateFields() : {};
      await api.post("/ecommerce/orders", {
        id: target.id,
        action: mode,
        ...values,
        returnReceived: returned,
      });
      message.success(
        mode === "ship"
          ? "发货信息已同步官网"
          : "退款已提交，请以支付渠道确认结果为准",
      );
      setTarget(null);
      await load();
    } catch (e: any) {
      if (!e.errorFields)
        message.error(e.response?.data?.error || "操作失败，请刷新状态后重试");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Alert
        type="info"
        showIcon
        className="mb-4"
        message="伊娃东方舞官网商城 · 伊娃甄选"
        description={`商品、价格与可售库存共用本平台数据；官网订单自动同步。快递包邮。微信支付：${payment.wechat ? "已配置" : "待开通"}；支付宝：${payment.alipay ? "已配置" : "待开通"}。未付款订单暂时占用库存，安全关单后自动释放。`}
      />
      <Space className="mb-4">
        <Button onClick={() => void load()} loading={loading}>
          刷新订单
        </Button>
        <Button href="https://www.swod.com.cn/shop/selection" target="_blank">
          打开官网商城
        </Button>
      </Space>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={orders}
        scroll={{ x: 1200 }}
        pagination={{
          current: page,
          pageSize: 50,
          total,
          onChange: setPage,
          showSizeChanger: false,
        }}
        columns={[
          {
            title: "订单",
            key: "order",
            width: 220,
            render: (_, o: Order) => (
              <>
                <div style={{ wordBreak: "break-all" }}>{o.id}</div>
                <small>{new Date(o.createdAt).toLocaleString("zh-CN")}</small>
                <div>学员 #{o.memberId}</div>
              </>
            ),
          },
          {
            title: "商品",
            key: "items",
            width: 260,
            render: (_, o: Order) =>
              o.items.map((i, n) => (
                <div key={n}>
                  {i.name} × {i.quantity}
                  <div style={{ color: "#888", fontSize: 12 }}>{i.spec}</div>
                </div>
              )),
          },
          {
            title: "收货信息",
            key: "address",
            width: 230,
            render: (_, o: Order) => (
              <>
                {o.recipient} {o.phone}
                <div>{o.address}</div>
                {o.trackingNo && (
                  <div>
                    {o.carrier} {o.trackingNo}
                  </div>
                )}
              </>
            ),
          },
          {
            title: "金额 / 支付",
            key: "amount",
            width: 140,
            render: (_, o: Order) => (
              <>
                ¥{(o.totalFen / 100).toFixed(2)}
                <div>
                  {o.provider === "wechat" ? "微信支付" : "支付宝"} · 包邮
                </div>
              </>
            ),
          },
          {
            title: "状态",
            key: "status",
            width: 160,
            render: (_, o: Order) => (
              <>
                <Tag
                  color={
                    o.status === "paid"
                      ? "green"
                      : o.status.includes("refund")
                        ? "orange"
                        : "default"
                  }
                >
                  {names[o.status] || o.status}
                </Tag>
                {o.refundReason && <div>{o.refundReason}</div>}
              </>
            ),
          },
          {
            title: "操作",
            key: "actions",
            width: 180,
            render: (_, o: Order) => (
              <Space wrap>
                {o.status === "paid" && (
                  <Button
                    size="small"
                    type="primary"
                    onClick={() => {
                      setTarget(o);
                      setMode("ship");
                      form.resetFields();
                    }}
                  >
                    发货
                  </Button>
                )}
                {[
                  "paid",
                  "shipped",
                  "completed",
                  "refund_requested",
                  "refunding",
                ].includes(o.status) && (
                  <Button
                    danger
                    size="small"
                    onClick={() => {
                      setTarget(o);
                      setMode("refund");
                      setReturned(false);
                    }}
                  >
                    原路退款
                  </Button>
                )}
                {["pending", "refunding"].includes(o.status) && (
                  <Button
                    size="small"
                    onClick={async () => {
                      try {
                        await api.post("/ecommerce/orders", {
                          id: o.id,
                          action: "refresh",
                        });
                        await load();
                      } catch (e: any) {
                        message.error(e.response?.data?.error || "查询失败");
                      }
                    }}
                  >
                    查支付
                  </Button>
                )}
              </Space>
            ),
          },
        ]}
      />
      <Modal
        open={!!target}
        title={mode === "ship" ? "订单发货" : "确认原路退款"}
        onCancel={() => {
          if (!busy) setTarget(null);
        }}
        onOk={() => void submit()}
        confirmLoading={busy}
        okButtonProps={{
          disabled:
            mode === "refund" &&
            !!target?.shippedAt &&
            !returned &&
            target?.status !== "refunding",
        }}
        destroyOnHidden
      >
        {mode === "ship" ? (
          <Form form={form} layout="vertical">
            <Form.Item
              name="carrier"
              label="快递公司"
              rules={[{ required: true, max: 50 }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="trackingNo"
              label="快递单号"
              rules={[{ required: true, pattern: /^[A-Za-z0-9-]{5,60}$/ }]}
            >
              <Input />
            </Form.Item>
          </Form>
        ) : (
          <>
            <p>
              将退回 ¥{((target?.totalFen || 0) / 100).toFixed(2)}{" "}
              至原支付账户。仅管理员可操作，退款成功后自动恢复库存并记录销售冲销。
            </p>
            {!!target?.shippedAt && (
              <Checkbox
                checked={returned}
                onChange={(e) => setReturned(e.target.checked)}
              >
                已收到退回商品，并确认可以重新入库
              </Checkbox>
            )}
            <p style={{ color: "#888", marginTop: 12 }}>
              网络异常请刷新查询；再次提交会复用同一退款单号。
            </p>
          </>
        )}
      </Modal>
    </>
  );
}
