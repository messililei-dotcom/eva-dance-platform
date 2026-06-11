'use client';
import { useEffect, useMemo, useState } from 'react';
import { App, Button, Card, Col, Empty, Form, Input, InputNumber, Modal, Progress, Row, Select, Spin, Statistic, Table, Tabs, Tag, Typography } from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined, BankOutlined, BarChartOutlined, DollarOutlined, FundOutlined, PlusOutlined, RiseOutlined, WalletOutlined } from '@ant-design/icons';
import dynamic from 'next/dynamic';
import { platformAdapter } from '@/lib/adapters/platform';
import { ecommerceApi, eduApi } from '@/lib/api';
import { isRecord, pickArray } from '@/lib/data-shape';
import { formatCompactMoney, formatPaymentAmount } from '@/lib/money-format';
import { sortableColumns } from '@/lib/table-sort';
import type { FinanceSummary, UnifiedOrder } from '@/types/domain';

const { Text, Title } = Typography;
const ReactECharts = dynamic(() => import('echarts-for-react'), {
  ssr: false,
  loading: () => <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin /></div>,
});

type MoneyBucket = { label: string; value: number; count: number };
type CashflowRow = {
  id: string;
  date: string;
  direction: 'income' | 'expense';
  source: string;
  title: string;
  amount: number;
  note?: string;
};
type FinanceSourceRow = Record<string, unknown>;
type FinanceExpenseRow = {
  id: number;
  category?: string;
  title?: string;
  amount?: number;
  expense_date?: string;
  payment_method?: string;
  remark?: string;
  created_at?: string;
};

function amount(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function money(value: number) {
  return formatPaymentAmount(value);
}

function percent(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}

function dateText(value: unknown) {
  return String(value || '-').replace('T', ' ').slice(0, 10);
}

function textValue(value: unknown, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function monthKey(value: unknown) {
  const text = dateText(value);
  return text.length >= 7 ? text.slice(0, 7) : '未标记';
}

function typeLabel(value: unknown) {
  const raw = String(value || '').trim();
  const normalized = raw.toLowerCase().replace(/[\s-]+/g, '_');
  const map: Record<string, string> = {
    course: '线上课程',
    online: '线上课程',
    online_course: '线上课程',
    online_courses: '线上课程',
    course_online: '线上课程',
    training: '线下培训',
    offline_training: '线下培训',
    offline_training_course: '线下培训',
    offline_training_payment: '线下培训',
    offline_course: '线下培训',
    offline_courses: '线下培训',
    shop: '电商订单',
    ecommerce: '电商销售',
    ecommerce_sale: '电商销售',
    shop_sale: '电商销售',
    finance: '财务收入',
    membership: '学员缴费',
    member_payment: '学员缴费',
    refund: '退款',
    stock: '进货成本',
    stock_in: '进货成本',
    stock_cost: '进货成本',
    expense: '日常支出',
  };
  return map[normalized] || raw || '其他';
}

function mergeBuckets(items: MoneyBucket[]) {
  const map = new Map<string, MoneyBucket>();
  items.forEach(item => {
    const current = map.get(item.label) || { label: item.label, value: 0, count: 0 };
    current.value += amount(item.value);
    current.count += amount(item.count);
    map.set(item.label, current);
  });
  return Array.from(map.values()).filter(item => item.value > 0 || item.count > 0).sort((a, b) => b.value - a.value);
}

export default function FinancePage() {
  const { message } = App.useApp();
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [legacySummary, setLegacySummary] = useState<FinanceSourceRow | null>(null);
  const [shopSales, setShopSales] = useState<FinanceSourceRow[]>([]);
  const [stockLogs, setStockLogs] = useState<FinanceSourceRow[]>([]);
  const [products, setProducts] = useState<FinanceSourceRow[]>([]);
  const [manualExpenses, setManualExpenses] = useState<FinanceExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const [expenseForm] = Form.useForm();

  const loadFinance = () => {
    setLoading(true);
    Promise.all([
      platformAdapter.getFinanceSummary().catch(() => null),
      eduApi.getFinanceSummary().catch(() => null),
      ecommerceApi.getSales().catch(() => []),
      ecommerceApi.getStockLogs().catch(() => []),
      ecommerceApi.getProducts().catch(() => []),
      eduApi.getFinanceExpenses().catch(() => []),
    ])
      .then(([nextSummary, financeData, salesData, stockData, productData, expenseData]) => {
        setSummary(nextSummary);
        setLegacySummary(isRecord(financeData) ? financeData : null);
        setShopSales(pickArray<FinanceSourceRow>(salesData));
        setStockLogs(pickArray<FinanceSourceRow>(stockData));
        setProducts(pickArray<FinanceSourceRow>(productData));
        setManualExpenses(pickArray<FinanceExpenseRow>(expenseData));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadFinance();
  }, []);

  const openExpenseModal = () => {
    expenseForm.setFieldsValue({
      category: '日常支出',
      title: '',
      amount: undefined,
      expense_date: new Date().toISOString().slice(0, 10),
      payment_method: '微信',
      remark: '',
    });
    setExpenseModalOpen(true);
  };

  const submitExpense = async () => {
    const values = await expenseForm.validateFields();
    setSavingExpense(true);
    try {
      await eduApi.createFinanceExpense(values);
      message.success('支出已新增');
      setExpenseModalOpen(false);
      loadFinance();
    } catch (error: any) {
      message.error(error?.response?.data?.error || error?.message || '新增支出失败');
    } finally {
      setSavingExpense(false);
    }
  };

  const dashboard = useMemo(() => {
    const orderIncome = amount(summary?.income);
    const legacyIncome = amount(legacySummary?.totalIncome);
    const ecommerceIncome = shopSales.reduce((sum, row) => sum + amount(row.total_amount ?? row.totalPrice ?? row.amount), 0);
    const refundExpense = amount(summary?.refunds);
    const legacyExpense = amount(legacySummary?.totalExpense);
    const manualExpense = manualExpenses.reduce((sum, row) => sum + amount(row.amount), 0);
    const stockExpense = stockLogs
      .filter(row => String(row.change_type || row.type || '').includes('入') || String(row.direction || '').includes('入'))
      .reduce((sum, row) => sum + amount(row.cost_price ?? row.costPrice) * amount(row.quantity), 0);
    const stockAsset = products.reduce((sum, row) => sum + amount(row.stock ?? row.quantity) * amount(row.cost_price ?? row.costPrice), 0);

    const income = orderIncome + legacyIncome + ecommerceIncome;
    const expense = refundExpense + legacyExpense + manualExpense + stockExpense;
    const net = income - expense;
    const incomeBuckets = mergeBuckets([
      ...(summary?.byType || []).map(item => ({ label: item.label, value: item.value, count: item.count })),
      legacyIncome ? { label: 'finance', value: legacyIncome, count: pickArray<FinanceSourceRow>(legacySummary?.incomeRecords).length || 1 } : { label: 'finance', value: 0, count: 0 },
      ecommerceIncome ? { label: 'ecommerce', value: ecommerceIncome, count: shopSales.length } : { label: 'ecommerce', value: 0, count: 0 },
    ]);
    const expenseBuckets = mergeBuckets([
      refundExpense ? { label: 'refund', value: refundExpense, count: 1 } : { label: 'refund', value: 0, count: 0 },
      legacyExpense ? { label: 'expense', value: legacyExpense, count: pickArray<FinanceSourceRow>(legacySummary?.expenseRecords).length || 1 } : { label: 'expense', value: 0, count: 0 },
      manualExpense ? { label: 'expense', value: manualExpense, count: manualExpenses.length } : { label: 'expense', value: 0, count: 0 },
      stockExpense ? { label: 'stock', value: stockExpense, count: stockLogs.length } : { label: 'stock', value: 0, count: 0 },
    ]);
    const orderRows: CashflowRow[] = (summary?.recentOrders || []).map(row => ({
      id: `order-${row.id}`,
      date: row.orderDate,
      direction: row.status === 'refunded' ? 'expense' : 'income',
      source: typeLabel(row.orderType),
      title: row.title || row.orderNo,
      amount: amount(row.amount),
      note: row.memberName,
    }));
    const saleRows: CashflowRow[] = shopSales.slice(0, 20).map(row => ({
      id: `sale-${row.id}`,
      date: dateText(row.sale_date ?? row.date ?? row.created_at),
      direction: 'income',
      source: '电商销售',
      title: textValue(row.product_name ?? row.productName, '商品销售'),
      amount: amount(row.total_amount ?? row.totalPrice ?? row.amount),
      note: textValue(row.channel ?? row.member_name ?? row.customer_name, undefined),
    }));
    const expenseRows: CashflowRow[] = [
      ...pickArray<FinanceSourceRow>(legacySummary?.expenseRecords).map(row => ({
        id: `expense-${row.id}`,
        date: dateText(row.expenseDate ?? row.date ?? row.created_at),
        direction: 'expense' as const,
        source: textValue(row.category, '日常支出'),
        title: textValue(row.remark ?? row.category, '支出流水'),
        amount: amount(row.amount),
      })),
      ...manualExpenses.map(row => ({
        id: `manual-expense-${row.id}`,
        date: dateText(row.expense_date ?? row.created_at),
        direction: 'expense' as const,
        source: textValue(row.category, '日常支出'),
        title: textValue(row.title, '支出流水'),
        amount: amount(row.amount),
        note: textValue(row.remark ?? row.payment_method, undefined),
      })),
      ...stockLogs
        .filter(row => String(row.change_type || '').includes('入') || String(row.direction || '').includes('入'))
        .slice(0, 20)
        .map(row => ({
          id: `stock-${row.id}`,
          date: dateText(row.created_at ?? row.date),
          direction: 'expense' as const,
          source: '进货成本',
          title: textValue(row.product_name ?? row.productName, '商品入库'),
          amount: amount(row.cost_price ?? row.costPrice) * amount(row.quantity),
          note: `${amount(row.quantity)} 件`,
        })),
    ];
    const cashflow = [...orderRows, ...saleRows, ...expenseRows].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 30);
    const trendMap = new Map<string, { month: string; income: number; expense: number }>();
    cashflow.forEach(row => {
      const key = monthKey(row.date);
      const current = trendMap.get(key) || { month: key, income: 0, expense: 0 };
      current[row.direction] += row.amount;
      trendMap.set(key, current);
    });
    const trend = Array.from(trendMap.values()).sort((a, b) => a.month.localeCompare(b.month)).slice(-8);

    return {
      income,
      expense,
      net,
      orderCount: amount(summary?.orderCount) + shopSales.length + pickArray<FinanceSourceRow>(legacySummary?.incomeRecords).length,
      averageOrder: income ? Math.round(income / Math.max(1, amount(summary?.orderCount) + shopSales.length)) : 0,
      profitRate: income ? Math.round((net / income) * 100) : 0,
      stockAsset,
      incomeBuckets,
      expenseBuckets,
      cashflow,
      trend,
    };
  }, [summary, legacySummary, shopSales, stockLogs, products, manualExpenses]);

  const pieOption = useMemo(() => ({
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0 },
    series: [{
      type: 'pie',
      radius: ['48%', '70%'],
      data: dashboard.incomeBuckets.map(item => ({ name: typeLabel(item.label), value: Math.round(item.value) })),
      color: ['#F72A8A', '#7C3AED', '#3B82F6', '#22C55E', '#F59E0B', '#64748B'],
    }],
  }), [dashboard.incomeBuckets]);

  const trendOption = useMemo(() => ({
    tooltip: { trigger: 'axis' },
    legend: { top: 0 },
    grid: { left: 48, right: 20, top: 44, bottom: 36 },
    xAxis: { type: 'category', data: dashboard.trend.map(item => item.month) },
    yAxis: { type: 'value' },
    series: [
      { name: '收入', type: 'bar', data: dashboard.trend.map(item => Math.round(item.income)), itemStyle: { color: '#22C55E' } },
      { name: '支出', type: 'bar', data: dashboard.trend.map(item => Math.round(item.expense)), itemStyle: { color: '#EF4444' } },
      { name: '净额', type: 'line', smooth: true, data: dashboard.trend.map(item => Math.round(item.income - item.expense)), itemStyle: { color: '#3B82F6' } },
    ],
  }), [dashboard.trend]);

  if (loading) return <div style={{ padding: 80, textAlign: 'center' }}><Spin size="large" /></div>;

  return (
    <div>
      <div className="page-header">
        <Row justify="space-between" align="middle" gutter={[12, 12]}>
          <Col>
            <Title level={2}>财务中心</Title>
            <Text type="secondary">老板经营总览：汇总课程收款、电商销售、退款、日常支出、进货成本与库存资产。</Text>
          </Col>
          <Col>
            <Button type="primary" icon={<PlusOutlined />} onClick={openExpenseModal}>新增支出</Button>
          </Col>
        </Row>
      </div>

      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col xs={24} md={6}><Card><Statistic title="总收入" value={formatCompactMoney(dashboard.income)} prefix={<ArrowUpOutlined />} valueStyle={{ color: '#16A34A' }} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="总支出" value={formatCompactMoney(dashboard.expense)} prefix={<ArrowDownOutlined />} valueStyle={{ color: '#DC2626' }} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="经营净额" value={formatCompactMoney(dashboard.net)} prefix={<WalletOutlined />} valueStyle={{ color: dashboard.net >= 0 ? '#2563EB' : '#DC2626' }} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="利润率" value={dashboard.profitRate} suffix="%" prefix={<RiseOutlined />} valueStyle={{ color: dashboard.profitRate >= 0 ? '#7C3AED' : '#DC2626' }} /></Card></Col>
      </Row>

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={6}><Card><Statistic title="成交/收入笔数" value={dashboard.orderCount} suffix="笔" prefix={<DollarOutlined />} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="平均收入单价" value={money(dashboard.averageOrder)} prefix={<BankOutlined />} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="本月收入" value={formatCompactMoney(summary?.monthIncome || 0)} prefix={<FundOutlined />} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="库存成本资产" value={formatCompactMoney(dashboard.stockAsset)} prefix={<BarChartOutlined />} /></Card></Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} xl={10}>
          <Card title="收入构成">
            {dashboard.incomeBuckets.length ? <ReactECharts option={pieOption} style={{ height: 300 }} /> : <Empty description="暂无收入构成" />}
          </Card>
        </Col>
        <Col xs={24} xl={14}>
          <Card title="收入 / 支出趋势">
            {dashboard.trend.length ? <ReactECharts option={trendOption} style={{ height: 300 }} /> : <Empty description="暂无趋势数据" />}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="收入排名">
            {dashboard.incomeBuckets.length ? dashboard.incomeBuckets.map(item => (
              <div key={item.label} style={{ marginBottom: 14 }}>
                <Row justify="space-between">
                  <Col><Text strong>{typeLabel(item.label)}</Text><Tag color="green" style={{ marginLeft: 8 }}>{item.count} 笔</Tag></Col>
                  <Col><Text strong>{money(item.value)}</Text></Col>
                </Row>
                <Progress percent={percent(item.value, dashboard.income)} strokeColor="#16A34A" />
              </div>
            )) : <Empty description="暂无收入数据" />}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="支出构成">
            {dashboard.expenseBuckets.length ? dashboard.expenseBuckets.map(item => (
              <div key={item.label} style={{ marginBottom: 14 }}>
                <Row justify="space-between">
                  <Col><Text strong>{typeLabel(item.label)}</Text><Tag color="red" style={{ marginLeft: 8 }}>{item.count} 笔</Tag></Col>
                  <Col><Text strong>{money(item.value)}</Text></Col>
                </Row>
                <Progress percent={percent(item.value, dashboard.expense)} strokeColor="#EF4444" />
              </div>
            )) : <Empty description="暂无支出数据" />}
          </Card>
        </Col>
      </Row>

      <Tabs
        items={[
          {
            key: 'cashflow',
            label: `现金流水 ${dashboard.cashflow.length}`,
            children: (
              <Card styles={{ body: { padding: 0 } }}>
                <Table<CashflowRow>
                  scroll={{ x: 'max-content' }}
                  rowKey="id"
                  size="middle"
                  dataSource={dashboard.cashflow}
                  pagination={{ pageSize: 12 }}
                  locale={{ emptyText: <Empty description="暂无现金流水" /> }}
                  columns={sortableColumns<CashflowRow>([
                    { title: '日期', dataIndex: 'date', width: 130 },
                    { title: '方向', dataIndex: 'direction', width: 100, render: value => value === 'income' ? <Tag color="green">收入</Tag> : <Tag color="red">支出</Tag> },
                    { title: '来源', dataIndex: 'source', width: 140 },
                    { title: '项目', dataIndex: 'title', ellipsis: true },
                    { title: '金额', dataIndex: 'amount', width: 140, align: 'right' as const, render: (value, record) => <Text strong style={{ color: record.direction === 'income' ? '#16A34A' : '#DC2626' }}>{record.direction === 'income' ? '+' : '-'}{money(value)}</Text> },
                    { title: '备注', dataIndex: 'note', ellipsis: true },
                  ])}
                />
              </Card>
            ),
          },
          {
            key: 'orders',
            label: `订单收入 ${summary?.recentOrders?.length || 0}`,
            children: (
              <Card title="最近订单收入" styles={{ body: { padding: 0 } }}>
                <Table<UnifiedOrder>
                  scroll={{ x: 'max-content' }}
                  rowKey="id"
                  size="middle"
                  dataSource={summary?.recentOrders || []}
                  pagination={{ pageSize: 12 }}
                  locale={{ emptyText: <Empty description="暂无财务订单" /> }}
                  columns={sortableColumns<UnifiedOrder>([
                    { title: '订单号', dataIndex: 'orderNo' },
                    { title: '学员', dataIndex: 'memberName' },
                    { title: '类型', dataIndex: 'orderType', render: value => <Tag color="blue">{typeLabel(value)}</Tag> },
                    { title: '支付方式', dataIndex: 'payMethod' },
                    { title: '状态', dataIndex: 'status', render: value => <Tag color={value === 'refunded' ? 'red' : 'green'}>{value}</Tag> },
                    { title: '金额', dataIndex: 'amount', align: 'right' as const, render: value => <Text strong>{money(value)}</Text> },
                    { title: '日期', dataIndex: 'orderDate' },
                  ])}
                />
              </Card>
            ),
          },
          {
            key: 'expenses',
            label: `支出明细 ${dashboard.expenseBuckets.reduce((sum, item) => sum + item.count, 0)}`,
            children: (
              <Card title="支出明细" styles={{ body: { padding: 0 } }}>
                <Table<CashflowRow>
                  scroll={{ x: 'max-content' }}
                  rowKey="id"
                  size="middle"
                  dataSource={dashboard.cashflow.filter(item => item.direction === 'expense')}
                  pagination={{ pageSize: 12 }}
                  locale={{ emptyText: <Empty description="暂无支出明细" /> }}
                  columns={sortableColumns<CashflowRow>([
                    { title: '日期', dataIndex: 'date', width: 130 },
                    { title: '分类', dataIndex: 'source', width: 140, render: value => <Tag color="orange">{value || '未分类'}</Tag> },
                    { title: '项目', dataIndex: 'title', ellipsis: true },
                    { title: '金额', dataIndex: 'amount', align: 'right' as const, width: 140, render: value => <Text strong style={{ color: '#DC2626' }}>{money(value)}</Text> },
                    { title: '备注', dataIndex: 'note', ellipsis: true },
                  ])}
                />
              </Card>
            ),
          },
        ]}
      />

      <Modal
        className="finance-expense-modal"
        title="新增支出"
        open={expenseModalOpen}
        onCancel={() => setExpenseModalOpen(false)}
        onOk={submitExpense}
        okText="保存"
        cancelText="取消"
        confirmLoading={savingExpense}
        width={520}
        destroyOnClose
      >
        <Form form={expenseForm} layout="vertical">
          <Row gutter={[8, 0]}>
            <Col xs={12} md={12}>
              <Form.Item name="category" label="支出分类" rules={[{ required: true, message: '请选择支出分类' }]}>
                <Select options={['日常支出', '房租物业', '工资劳务', '营销推广', '办公采购', '交通差旅', '其他支出'].map(item => ({ value: item, label: item }))} />
              </Form.Item>
            </Col>
            <Col xs={12} md={12}>
              <Form.Item name="amount" label="支出金额" rules={[{ required: true, message: '请输入支出金额' }]}>
                <InputNumber min={0.01} precision={2} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="title" label="支出项目备注" rules={[{ required: true, message: '请输入支出项目备注' }]}>
                <Input placeholder="例如 场地租金 / 物料采购 / 推广费用" />
              </Form.Item>
            </Col>
            <Col xs={12} md={12}>
              <Form.Item name="expense_date" label="支出日期">
                <Input type="date" />
              </Form.Item>
            </Col>
            <Col xs={12} md={12}>
              <Form.Item name="payment_method" label="支付方式">
                <Select options={['微信', '支付宝', '银行卡', '现金', '其他'].map(item => ({ value: item, label: item }))} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="remark" label="备注">
                <Input.TextArea rows={2} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}
