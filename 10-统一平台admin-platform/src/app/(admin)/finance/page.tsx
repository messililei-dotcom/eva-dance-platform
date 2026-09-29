'use client';
import { useEffect, useMemo, useState } from 'react';
import { App, Button, Card, Col, Descriptions, Empty, Form, Input, InputNumber, Modal, Row, Select, Spin, Tabs, Tag, Typography } from 'antd';
import { Table } from '@/components/adaptive-table';
import { PlusOutlined } from '@ant-design/icons';
import { platformAdapter } from '@/lib/adapters/platform';
import { api, ecommerceApi, eduApi } from '@/lib/api';
import { isRecord, pickArray } from '@/lib/data-shape';
import { formatCompactMoney, formatPaymentAmount } from '@/lib/money-format';
import { sortableColumns } from '@/lib/table-sort';
import type { FinanceSummary } from '@/types/domain';
import styles from './finance.module.css';

const { Text, Title } = Typography;

type MoneyBucket = { label: string; value: number; count: number };
type FinancePeriodSummary = { title: string; period: string; income: number; expense: number; net: number; count: number };
type CashflowRow = {
  id: string;
  date: string;
  direction: 'income' | 'expense';
  source: string;
  title: string;
  amount: number;
  incomeType?: 'online-auth' | 'online-order' | 'offline-payment' | 'ecommerce-sale' | 'other';
  evidence?: string;
  referenceNo?: string;
  subject?: string;
  subjectMeta?: string;
  itemMeta?: string;
  orderNo?: string;
  customer?: string;
  phone?: string;
  courseSubType?: string;
  payMethod?: string;
  status?: string;
  remark?: string;
  sales?: string;
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
type IncomeLedgerSummary = {
  totalCount: number;
  totalAmount: number;
  yearCount: number;
  yearAmount: number;
  monthCount: number;
  monthAmount: number;
  currentYear: string;
  currentMonth: string;
};

function amount(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function money(value: number) {
  return formatPaymentAmount(value);
}

function dateText(value: unknown) {
  return String(value || '-').replace('T', ' ').slice(0, 10);
}

function textValue(value: unknown, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function detailText(value: unknown) {
  return textValue(value, '-');
}

function matchesCashflowKeyword(row: CashflowRow, keyword: string) {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) return true;
  return [
    row.date,
    row.source,
    row.evidence,
    row.referenceNo,
    row.orderNo,
    row.title,
    row.itemMeta,
    row.courseSubType,
    row.subject,
    row.subjectMeta,
    row.customer,
    row.phone,
    row.status,
    row.remark,
    row.sales,
    row.note,
    row.amount,
  ].some(value => String(value ?? '').toLowerCase().includes(normalized));
}

function monthKey(value: unknown) {
  const text = dateText(value);
  return text.length >= 7 ? text.slice(0, 7) : '未标记';
}

function isOnlineOrderType(value: unknown) {
  const normalized = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return ['online_course', 'online_courses', 'course', 'online', 'course_online'].includes(normalized);
}

function incomeTypeColor(value?: CashflowRow['incomeType']) {
  const map: Record<string, string> = {
    'online-auth': 'magenta',
    'online-order': 'purple',
    'offline-payment': 'blue',
    'ecommerce-sale': 'green',
    other: 'default',
  };
  return map[value || 'other'] || 'default';
}

function parseAuthId(text: unknown) {
  const match = String(text || '').match(/authorization_id=(\d+)|授权ID[:：]\s*(\d+)/);
  return match?.[1] || match?.[2] || '';
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

function periodSummary(title: string, period: string, incomeRows: CashflowRow[], expenseRows: CashflowRow[], matches: (row: CashflowRow) => boolean): FinancePeriodSummary {
  const periodIncomeRows = incomeRows.filter(matches);
  const income = periodIncomeRows.reduce((sum, row) => sum + amount(row.amount), 0);
  const expense = expenseRows.filter(matches).reduce((sum, row) => sum + amount(row.amount), 0);
  const net = income - expense;
  return {
    title,
    period,
    income,
    expense,
    net,
    count: periodIncomeRows.length,
  };
}

function FinancePeriodCard({ item }: { item: FinancePeriodSummary }) {
  return (
    <div className="finance-period-card">
      <div className="finance-period-card-head">
        <Text strong>{item.title}</Text>
        <Tag color="blue">{item.period}</Tag>
      </div>
      <div className="finance-period-stats">
        <div className="finance-period-stat finance-period-stat-income">
          <span>收入</span>
          <strong>{formatCompactMoney(item.income)}</strong>
          <em>{item.count} 笔</em>
        </div>
        <div className="finance-period-stat finance-period-stat-expense">
          <span>支出</span>
          <strong>{formatCompactMoney(item.expense)}</strong>
        </div>
        <div className="finance-period-stat finance-period-stat-net">
          <span>净额</span>
          <strong>{formatCompactMoney(item.net)}</strong>
        </div>
      </div>
    </div>
  );
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
  const [incomeDetailRecord, setIncomeDetailRecord] = useState<CashflowRow | null>(null);
  const [recordTab, setRecordTab] = useState('income');
  const [recordKeyword, setRecordKeyword] = useState('');
  const [incomeSearch, setIncomeSearch] = useState('');
  const [incomeRows, setIncomeRows] = useState<CashflowRow[]>([]);
  const [incomeTotal, setIncomeTotal] = useState(0);
  const [incomePage, setIncomePage] = useState(1);
  const [incomePageSize, setIncomePageSize] = useState(25);
  const [incomeLoading, setIncomeLoading] = useState(false);
  const [incomeLedgerSummary, setIncomeLedgerSummary] = useState<IncomeLedgerSummary | null>(null);
  const [expenseForm] = Form.useForm();

  const loadFinance = () => {
    setLoading(true);
    // Start every independent source immediately. FinanceIncome remains the
    // compact first-paint source, while large order/ecommerce feeds hydrate in
    // parallel instead of waiting for the first request to finish.
    const detailPromise = Promise.all([
      platformAdapter.getFinanceSummary().catch(() => null),
      ecommerceApi.getOverview().catch(() => ({ products: [], sales: [], stockLogs: [] })),
      eduApi.getFinanceExpenses().catch(() => []),
    ]);
    eduApi.getFinanceSummary()
      .catch(() => null)
      .then((financeData) => {
        setLegacySummary(isRecord(financeData) ? financeData : null);
        setLoading(false);
        return detailPromise;
      })
      .then((data) => {
        if (!data) return;
        const [nextSummary, commerceData, expenseData] = data;
        setSummary(nextSummary);
        setShopSales(pickArray<FinanceSourceRow>(commerceData.sales));
        setStockLogs(pickArray<FinanceSourceRow>(commerceData.stockLogs));
        setProducts(pickArray<FinanceSourceRow>(commerceData.products));
        setManualExpenses(pickArray<FinanceExpenseRow>(expenseData));
      });
  };

  useEffect(() => {
    loadFinance();
  }, []);

  useEffect(() => {
    let active = true;
    setIncomeLoading(true);
    api.get('/finance/income-details', { params: {
      page: incomePage,
      pageSize: incomePageSize,
      keyword: incomeSearch || undefined,
      includeSummary: incomeLedgerSummary ? 0 : 1,
    } }).then(response => {
      if (!active) return;
      const data = response.data || {};
      const rows = pickArray<FinanceSourceRow>(data?.data).map(row => {
        const source = textValue(row.source, '其他');
        const evidence = textValue(row.evidence, '');
        const sourceKind = textValue(row.sourceKind, '');
        const incomeType: CashflowRow['incomeType'] = sourceKind === 'ecommerce-sale'
          ? 'ecommerce-sale'
          : evidence.includes('学员授权')
            ? 'online-auth'
            : evidence.includes('线下')
              ? 'offline-payment'
              : isOnlineOrderType(source)
                ? 'online-order'
                : 'other';
        return {
          id: textValue(row.id),
          date: dateText(row.date),
          direction: 'income' as const,
          source: typeLabel(source),
          title: textValue(row.title, '收入流水'),
          amount: amount(row.amount),
          incomeType,
          evidence,
          referenceNo: textValue(row.referenceNo),
          subject: textValue(row.subject),
          subjectMeta: textValue(row.subjectMeta),
          itemMeta: textValue(row.itemMeta),
          payMethod: textValue(row.payMethod),
          status: textValue(row.status),
          remark: textValue(row.remark),
        };
      });
      setIncomeRows(rows);
      setIncomeTotal(amount(data?.total));
      if (isRecord(data?.summary)) setIncomeLedgerSummary(data.summary as IncomeLedgerSummary);
    }).catch((error: any) => {
      if (active) message.error(error?.response?.data?.error || '收入明细加载失败');
    }).finally(() => {
      if (active) setIncomeLoading(false);
    });
    return () => { active = false; };
    // Summary is intentionally excluded: setting it after first load must not
    // trigger a duplicate request. Later page requests automatically skip it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomePage, incomePageSize, incomeSearch, message]);

  const openExpenseModal = () => {
    expenseForm.setFieldsValue({
      category: '日常支出',
      title: '',
      amount: undefined,
      expense_date: new Date().toISOString().slice(0, 10),
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
    const financeOrders = summary?.recentOrders || [];
    // Historical online orders and authorization-generated income represent
    // separate revenue evidence and must both remain visible alongside offline
    // training and ecommerce sales.
    const paidFinanceOrders = financeOrders.filter(row => row.status !== 'refunded');
    const refundedFinanceOrders = financeOrders.filter(row => row.status === 'refunded');
    const orderIncome = paidFinanceOrders.reduce((sum, row) => sum + amount(row.amount), 0);
    const legacyIncome = amount(legacySummary?.totalIncome);
    const fallbackExpenseRows = pickArray<FinanceSourceRow>(legacySummary?.expenseRecords);
    const ecommerceIncome = shopSales.reduce((sum, row) => sum + amount(row.total_amount ?? row.totalPrice ?? row.amount), 0);
    const refundExpense = refundedFinanceOrders.reduce((sum, row) => sum + amount(row.amount), 0);
    const legacyExpense = manualExpenses.length ? 0 : amount(legacySummary?.totalExpense);
    const manualExpense = manualExpenses.reduce((sum, row) => sum + amount(row.amount), 0);
    const stockExpense = stockLogs
      .filter(row => String(row.change_type || row.type || '').includes('入') || String(row.direction || '').includes('入'))
      .reduce((sum, row) => sum + amount(row.cost_price ?? row.costPrice) * amount(row.quantity), 0);
    const stockAsset = products.reduce((sum, row) => sum + amount(row.stock ?? row.quantity) * amount(row.cost_price ?? row.costPrice), 0);

    const income = incomeLedgerSummary?.totalAmount ?? (orderIncome + legacyIncome + ecommerceIncome);
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
    const orderRows: CashflowRow[] = financeOrders.map(row => ({
      id: `order-${row.id}`,
      date: row.authorizationDate || row.orderDate,
      direction: row.status === 'refunded' ? 'expense' : 'income',
      source: typeLabel(row.orderType),
      title: row.title || row.orderNo,
      amount: amount(row.amount),
      incomeType: isOnlineOrderType(row.orderType) ? 'online-order' : 'offline-payment',
      evidence: isOnlineOrderType(row.orderType)
        ? (row.authorizationDate ? '授权关联订单' : '历史线上订单')
        : '线下缴费',
      referenceNo: row.orderNo,
      subject: row.memberName,
      subjectMeta: [row.memberPhone, row.sales ? `顾问 ${row.sales}` : ''].filter(Boolean).join(' / '),
      itemMeta: row.courseSubType || row.remark || '',
      orderNo: row.orderNo,
      customer: row.memberName,
      phone: row.memberPhone,
      courseSubType: row.courseSubType,
      payMethod: row.payMethod,
      status: row.status,
      remark: row.remark,
      sales: row.sales,
      note: row.memberName,
    }));
    const legacyIncomeRows: CashflowRow[] = pickArray<FinanceSourceRow>(legacySummary?.incomeRecords).map(row => ({
      id: `legacy-income-${row.id}`,
      date: dateText(row.income_date ?? row.incomeDate ?? row.date ?? row.created_at),
      direction: 'income',
      source: textValue(row.category, '财务收入'),
      title: textValue(row.title ?? row.remark, '收入流水').replace(/^线上课程授权收入[：:]\s*/, ''),
      amount: amount(row.amount),
      incomeType: textValue(row.category).includes('线上课程') ? 'online-auth' : 'other',
      evidence: textValue(row.category).includes('线上课程') ? '学员授权' : '财务录入',
      referenceNo: textValue(row.incomeNo ?? row.income_no, parseAuthId(row.remark) ? `授权-${parseAuthId(row.remark)}` : ''),
      subject: textValue(row.memberName ?? row.customer_name ?? row.customerName, ''),
      subjectMeta: textValue(row.memberId) ? `member_id ${row.memberId}` : '',
      itemMeta: parseAuthId(row.remark) ? `授权ID ${parseAuthId(row.remark)}` : '',
      payMethod: textValue(row.payment_method ?? row.account, ''),
      customer: textValue(row.memberName ?? row.customer_name ?? row.customerName, ''),
      phone: textValue(row.memberPhone ?? row.customer_phone ?? row.customerPhone, ''),
      remark: textValue(row.remark ?? row.note, ''),
      note: textValue(row.remark ?? row.note, undefined),
    }));
    const saleRows: CashflowRow[] = shopSales.map(row => ({
      id: `sale-${row.id}`,
      date: dateText(row.sale_date ?? row.date ?? row.created_at),
      direction: 'income',
      source: '电商销售',
      title: textValue(row.product_name ?? row.productName, '商品销售'),
      amount: amount(row.total_amount ?? row.totalPrice ?? row.amount),
      incomeType: 'ecommerce-sale',
      evidence: '电商销售',
      referenceNo: `电商-${row.id}`,
      subject: textValue(row.member_name ?? row.customer_name ?? row.customerName, ''),
      subjectMeta: textValue(row.customer_phone ?? row.customerPhone, ''),
      itemMeta: [
        amount(row.quantity) ? `${amount(row.quantity)} 件` : '',
        amount(row.unit_price ?? row.unitPrice) ? `单价 ${money(amount(row.unit_price ?? row.unitPrice))}` : '',
      ].filter(Boolean).join(' / '),
      orderNo: `电商-${row.id}`,
      customer: textValue(row.member_name ?? row.customer_name ?? row.customerName, ''),
      phone: textValue(row.customer_phone ?? row.customerPhone, ''),
      payMethod: textValue(row.channel, ''),
      remark: textValue(row.remark ?? row.note, ''),
      note: [
        textValue(row.member_name ?? row.customer_name ?? row.customerName, ''),
        textValue(row.customer_phone ?? row.customerPhone, ''),
        textValue(row.remark ?? row.note, ''),
      ].filter(Boolean).join(' / '),
    }));
    const expenseRows: CashflowRow[] = [
      ...(manualExpenses.length ? [] : fallbackExpenseRows).map(row => ({
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
        note: textValue(row.remark, undefined),
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
    const incomeRows = [...orderRows.filter(row => row.direction === 'income'), ...legacyIncomeRows, ...saleRows]
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const sortedExpenseRows = expenseRows.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const cashflow = [...incomeRows, ...sortedExpenseRows].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 30);
    const incomeDetail = incomeRows;
    const expenseDetail = sortedExpenseRows;
    const now = new Date();
    const currentYear = String(now.getFullYear());
    const currentMonth = `${currentYear}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const overview = incomeLedgerSummary ? [
      {
        title: '总计', period: '全部', income: incomeLedgerSummary.totalAmount,
        expense: sortedExpenseRows.reduce((sum, row) => sum + amount(row.amount), 0),
        net: incomeLedgerSummary.totalAmount - sortedExpenseRows.reduce((sum, row) => sum + amount(row.amount), 0),
        count: incomeLedgerSummary.totalCount,
      },
      {
        title: '本年', period: `${incomeLedgerSummary.currentYear || currentYear}年`, income: incomeLedgerSummary.yearAmount,
        expense: sortedExpenseRows.filter(row => dateText(row.date).startsWith(incomeLedgerSummary.currentYear || currentYear)).reduce((sum, row) => sum + amount(row.amount), 0),
        net: incomeLedgerSummary.yearAmount - sortedExpenseRows.filter(row => dateText(row.date).startsWith(incomeLedgerSummary.currentYear || currentYear)).reduce((sum, row) => sum + amount(row.amount), 0),
        count: incomeLedgerSummary.yearCount,
      },
      {
        title: '本月', period: incomeLedgerSummary.currentMonth || currentMonth, income: incomeLedgerSummary.monthAmount,
        expense: sortedExpenseRows.filter(row => dateText(row.date).startsWith(incomeLedgerSummary.currentMonth || currentMonth)).reduce((sum, row) => sum + amount(row.amount), 0),
        net: incomeLedgerSummary.monthAmount - sortedExpenseRows.filter(row => dateText(row.date).startsWith(incomeLedgerSummary.currentMonth || currentMonth)).reduce((sum, row) => sum + amount(row.amount), 0),
        count: incomeLedgerSummary.monthCount,
      },
    ] : [
      periodSummary('总计', '全部', incomeRows, sortedExpenseRows, () => true),
      periodSummary('本年', `${currentYear}年`, incomeRows, sortedExpenseRows, row => dateText(row.date).startsWith(currentYear)),
      periodSummary('本月', currentMonth, incomeRows, sortedExpenseRows, row => dateText(row.date).startsWith(currentMonth)),
    ];
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
      orderCount: incomeLedgerSummary?.totalCount ?? (paidFinanceOrders.length + shopSales.length + pickArray<FinanceSourceRow>(legacySummary?.incomeRecords).length),
      averageOrder: income ? Math.round(income / Math.max(1, paidFinanceOrders.length + shopSales.length + pickArray<FinanceSourceRow>(legacySummary?.incomeRecords).length)) : 0,
      stockAsset,
      incomeBuckets,
      expenseBuckets,
      cashflow,
      incomeDetail,
      expenseDetail,
      overview,
      trend,
    };
  }, [summary, legacySummary, shopSales, stockLogs, products, manualExpenses, incomeLedgerSummary]);
  const filteredExpenseDetail = useMemo(
    () => dashboard.expenseDetail.filter(row => matchesCashflowKeyword(row, recordKeyword)),
    [dashboard.expenseDetail, recordKeyword],
  );

  if (loading) return <div style={{ padding: 80, textAlign: 'center' }}><Spin size="large" /></div>;

  return (
    <div className={`finance-admin-page ${styles.page}`}>
      <div className="page-header finance-page-header">
        <Row justify="space-between" align="middle" gutter={[10, 8]} wrap={false}>
          <Col flex="auto" className="finance-page-title">
            <Title level={2}>财务中心</Title>
            <Text type="secondary">经营总览：课程收款、电商销售、退款、支出、进货成本与库存资产。</Text>
          </Col>
          <Col flex="none">
            <Button type="primary" icon={<PlusOutlined />} onClick={openExpenseModal}>新增支出</Button>
          </Col>
        </Row>
      </div>

      <Card className="finance-overview-card" styles={{ body: { padding: 0 } }}>
        <div className="finance-period-grid">
          {dashboard.overview.map(item => <FinancePeriodCard key={item.title} item={item} />)}
        </div>
      </Card>

      <Tabs
        className="finance-record-tabs"
        activeKey={recordTab}
        onChange={setRecordTab}
        tabBarExtraContent={{
          right: (
            <Input.Search
              allowClear
              value={recordKeyword}
              onChange={event => setRecordKeyword(event.target.value)}
              onSearch={value => {
                if (recordTab !== 'income') return;
                setIncomePage(1);
                setIncomeSearch(value.trim());
              }}
              placeholder={recordTab === 'income' ? '搜索收入记录' : '搜索支出记录'}
              style={{ width: 280 }}
            />
          ),
        }}
        items={[
          {
            key: 'income',
            label: `收入明细 ${incomeTotal}`,
            children: (
              <Card styles={{ body: { padding: 0 } }}>
                <Table<CashflowRow>
                  className="finance-clickable-table"
                  scroll={{ x: 'max-content', y: 'calc(100dvh - 360px)' }}
                  rowKey="id"
                  size="middle"
                  loading={incomeLoading}
                  dataSource={incomeRows}
                  pagination={{
                    current: incomePage,
                    pageSize: incomePageSize,
                    total: incomeTotal,
                    showSizeChanger: true,
                    showTotal: total => `共 ${total} 条`,
                    onChange: (page, pageSize) => { setIncomePage(page); setIncomePageSize(pageSize); },
                  }}
                  locale={{ emptyText: <Empty description="暂无收入明细" /> }}
                  onRow={record => ({
                    onClick: () => setIncomeDetailRecord(record),
                  })}
                  columns={sortableColumns<CashflowRow>([
                    { title: '日期', dataIndex: 'date', width: 130 },
                    {
                      title: '收入类型',
                      dataIndex: 'source',
                      width: 150,
                      render: (_value, record) => <Tag color={incomeTypeColor(record.incomeType)}>{record.source}</Tag>,
                    },
                    { title: '数据依据', dataIndex: 'evidence', width: 130, render: value => value || '-' },
                    { title: '业务单号', dataIndex: 'referenceNo', width: 150, render: (_value, record) => record.referenceNo || record.orderNo || '-' },
                    { title: '项目/商品/课程', dataIndex: 'title', ellipsis: true, width: 280 },
                    { title: '期次/规格/补充', dataIndex: 'itemMeta', ellipsis: true, width: 180, render: (_value, record) => record.itemMeta || record.courseSubType || '-' },
                    {
                      title: '学员/客户',
                      dataIndex: 'subject',
                      ellipsis: true,
                      width: 220,
                      render: (_value, record) => (
                        <div className="finance-income-subject">
                          <Text strong>{record.subject || record.customer || '-'}</Text>
                          {record.subjectMeta ? <Text type="secondary">{record.subjectMeta}</Text> : null}
                        </div>
                      ),
                    },
                    { title: '金额', dataIndex: 'amount', width: 140, align: 'right' as const, render: value => <Text strong style={{ color: '#16A34A' }}>{money(value)}</Text> },
                  ])}
                />
              </Card>
            ),
          },
          {
            key: 'expenses',
            label: `支出明细 ${recordKeyword ? `${filteredExpenseDetail.length}/` : ''}${dashboard.expenseDetail.length}`,
            children: (
              <Card title="支出明细" styles={{ body: { padding: 0 } }}>
                <Table<CashflowRow>
                  scroll={{ x: 'max-content', y: 'calc(100dvh - 360px)' }}
                  rowKey="id"
                  size="middle"
                  dataSource={filteredExpenseDetail}
                  pagination={{ pageSize: 25 }}
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
        title="收入明细"
        open={Boolean(incomeDetailRecord)}
        onCancel={() => setIncomeDetailRecord(null)}
        footer={null}
        width={720}
        destroyOnClose
      >
        {incomeDetailRecord && (
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="日期">{detailText(incomeDetailRecord.date)}</Descriptions.Item>
            <Descriptions.Item label="收入类型">{detailText(incomeDetailRecord.source)}</Descriptions.Item>
            <Descriptions.Item label="数据依据">{detailText(incomeDetailRecord.evidence)}</Descriptions.Item>
            <Descriptions.Item label="业务单号">{detailText(incomeDetailRecord.referenceNo || incomeDetailRecord.orderNo)}</Descriptions.Item>
            <Descriptions.Item label="状态">{detailText(incomeDetailRecord.status)}</Descriptions.Item>
            <Descriptions.Item label="项目" span={2}>{detailText(incomeDetailRecord.title)}</Descriptions.Item>
            <Descriptions.Item label="期次/规格/补充">{detailText(incomeDetailRecord.itemMeta || incomeDetailRecord.courseSubType)}</Descriptions.Item>
            <Descriptions.Item label="金额">{money(incomeDetailRecord.amount)}</Descriptions.Item>
            <Descriptions.Item label="学员/客户">{detailText(incomeDetailRecord.subject || incomeDetailRecord.customer)}</Descriptions.Item>
            <Descriptions.Item label="身份信息">{detailText(incomeDetailRecord.subjectMeta || incomeDetailRecord.phone)}</Descriptions.Item>
            <Descriptions.Item label="课程顾问">{detailText(incomeDetailRecord.sales)}</Descriptions.Item>
            <Descriptions.Item label="备注" span={2}>{detailText(incomeDetailRecord.remark || incomeDetailRecord.note)}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

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
