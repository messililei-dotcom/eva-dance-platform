'use client';
import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import Link from 'next/link';
import { Alert, App, AutoComplete, Button, Card, Col, DatePicker, Descriptions, Empty, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Spin, Statistic, Tabs, Tag, Typography } from 'antd';
import { Table } from '@/components/adaptive-table';
import { BarChartOutlined, CalendarOutlined, DollarOutlined, FileSearchOutlined, LockOutlined, SearchOutlined, TeamOutlined, TrophyOutlined, UnlockOutlined } from '@ant-design/icons';
import { trainingApi } from '@/lib/api';
import { buildCourseAdvisorOptions, filterCourseAdvisorOption } from '@/lib/course-advisors';
import { formatCompactMoney, formatPaymentAmount } from '@/lib/money-format';
import { compareTableValues, sortableColumns } from '@/lib/table-sort';

const { Text, Title } = Typography;
const MAIN_TABLE_SCROLL_Y = 'max(240px, calc(100dvh - 440px))';

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

function textValue(value: unknown, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function dateText(value: unknown) {
  return String(value || '-').replace('T', ' ').slice(0, 10);
}

function monthKey(value: unknown) {
  const text = dateText(value);
  return text.length >= 7 ? text.slice(0, 7) : '未标记';
}

function yearKey(value: unknown) {
  const text = dateText(value);
  return /^\d{4}/.test(text) ? text.slice(0, 4) : '未标记';
}

function money(value: unknown) {
  return formatPaymentAmount(value);
}

function advisorName(value: unknown) {
  return textValue(value, '未填写顾问');
}

function commissionFromPayment(row: PaymentRow) {
  const paidAmount = numberValue(row.amount);
  const rate = numberValue(row.commissionRate);
  const storedCommission = numberValue(row.commissionAmount, Number.NaN);
  const commission = Number.isFinite(storedCommission)
    ? storedCommission
    : Math.round((paidAmount * rate / 100) * 100) / 100;
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

function summarizeRows(rows: CommissionDetailRow[], keyFor: (row: CommissionDetailRow) => { key: string; advisor: string; period?: string }) {
  const map = new Map<string, SummaryRow>();
  rows.forEach(row => {
    const keyInfo = keyFor(row);
    const current = map.get(keyInfo.key) || {
      key: keyInfo.key,
      advisor: keyInfo.advisor,
      period: keyInfo.period,
      paymentCount: 0,
      paidAmount: 0,
      commission: 0,
      avgRate: 0,
      latestDate: '',
    };
    current.paymentCount += 1;
    current.paidAmount += row.paidAmount;
    current.commission += row.commission;
    const rowDate = dateText(row.date || row.created_at);
    if (!current.latestDate || rowDate > current.latestDate) current.latestDate = rowDate;
    current.avgRate = current.paidAmount ? Math.round((current.commission / current.paidAmount * 100) * 100) / 100 : 0;
    map.set(keyInfo.key, current);
  });
  return Array.from(map.values()).sort((a, b) => b.commission - a.commission);
}

export default function BonusCommissionPage() {
  const { message } = App.useApp();
  const [editForm] = Form.useForm();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [settlements, setSettlements] = useState<SettlementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingSettlementKey, setSavingSettlementKey] = useState('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [advisorFilter, setAdvisorFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [editingPayment, setEditingPayment] = useState<CommissionDetailRow | null>(null);
  const editAmount = Form.useWatch('amount', editForm);
  const editCommissionRate = Form.useWatch('commissionRate', editForm);

  const loadPayments = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [paymentRows, settlementRows, onlineRows] = await Promise.all([
        trainingApi.getPayments(),
        trainingApi.getCommissionSettlements(),
        trainingApi.getOnlineAuthorizationCommissions(),
      ]);
      if (!Array.isArray(paymentRows) || !Array.isArray(settlementRows) || !Array.isArray(onlineRows)) {
        throw new Error('提成数据格式异常，请重试');
      }
      setPayments([...paymentRows, ...onlineRows]);
      setSettlements(settlementRows);
    } catch (error: any) {
      setLoadError(error?.response?.data?.error || error?.message || '提成数据加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('admin_user') || localStorage.getItem('userData');
      const user = raw ? JSON.parse(raw) : {};
      setIsSuperAdmin(user?.username === 'lilei' || user?.role === 'admin');
    } catch {
      setIsSuperAdmin(false);
    }
  }, []);

  useEffect(() => {
    if (!editingPayment) return;
    const amount = numberValue(editAmount);
    const rate = numberValue(editCommissionRate);
    editForm.setFieldsValue({ commissionAmount: Math.round((amount * rate / 100) * 100) / 100 });
  }, [editAmount, editCommissionRate, editForm, editingPayment]);

  const openPaymentEdit = (record: CommissionDetailRow) => {
    if (record.source === 'online') {
      message.info('线上授权记录已纳入统计，实收与提成以授权时保存的金额为准');
      return;
    }
    if (isSettled(record.advisor, record.month) && !isSuperAdmin) {
      message.warning('该月份提成已结清，仅超级管理员可修改相关缴费记录');
      return;
    }
    setEditingPayment(record);
    editForm.setFieldsValue({
      date: record.date ? dayjs(record.date) : null,
      sales: record.sales || '',
      amount: record.paidAmount,
      commissionRate: record.rate,
      commissionAmount: record.commission,
      remainingSessions: record.remainingSessions ?? 0,
      remark: record.remark || '',
    });
  };

  const savePaymentEdit = async () => {
    if (!editingPayment) return;
    const values = await editForm.validateFields();
    const amount = numberValue(values.amount);
    const commissionRate = numberValue(values.commissionRate);
    const commissionAmount = Math.round((amount * commissionRate / 100) * 100) / 100;
    setSaving(true);
    try {
      await trainingApi.updatePayment(editingPayment.id, {
        amount,
        commissionRate,
        commissionAmount,
        date: values.date ? values.date.format('YYYY-MM-DD') : '',
        sales: String(values.sales || '').trim(),
        remainingSessions: values.remainingSessions ?? editingPayment.remainingSessions ?? 0,
        remark: values.remark || '',
      });
      message.success('缴费记录已更新');
      setEditingPayment(null);
      loadPayments();
    } catch (error: any) {
      message.error(error?.response?.data?.error || error?.message || '保存缴费记录失败');
    } finally {
      setSaving(false);
    }
  };

  const detailRows = useMemo(() => payments.map(toDetailRow)
    .filter(row => row.commission > 0)
    .sort((a, b) => String(b.date || b.created_at || '').localeCompare(String(a.date || a.created_at || ''))
      || String(b.created_at || '').localeCompare(String(a.created_at || ''))
      || b.id - a.id), [payments]);
  const advisorInputOptions = useMemo(() => buildCourseAdvisorOptions(detailRows.map(row => row.advisor)), [detailRows]);
  const advisorSelectOptions = useMemo(() => [
    { value: 'all', label: '全部课程顾问' },
    ...advisorInputOptions,
  ], [advisorInputOptions]);
  const yearOptions = useMemo(() => ['all', ...Array.from(new Set(detailRows.map(row => row.year))).sort((a, b) => b.localeCompare(a))], [detailRows]);
  const settledKeys = useMemo(() => new Set(settlements.filter(row => row.status === 'settled').map(row => `${row.period}||${row.advisor}`)), [settlements]);
  const isSettled = (advisor: string, period: string) => settledKeys.has(`${period}||${advisor}`);

  const filteredRows = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    return detailRows.filter(row => {
      if (advisorFilter !== 'all' && row.advisor !== advisorFilter) return false;
      if (yearFilter !== 'all' && row.year !== yearFilter) return false;
      if (!query) return true;
      return [row.advisor, row.memberName, row.memberPhone, row.courseName, row.courseSubType, row.remark]
        .some(value => String(value || '').toLowerCase().includes(query));
    });
  }, [advisorFilter, detailRows, keyword, yearFilter]);

  const dashboard = useMemo(() => {
    const totalCommission = filteredRows.reduce((sum, row) => sum + row.commission, 0);
    const totalPaidAmount = filteredRows.reduce((sum, row) => sum + row.paidAmount, 0);
    const payableCount = filteredRows.filter(row => row.commission > 0).length;
    const advisors = new Set(filteredRows.map(row => row.advisor));
    return {
      totalCommission,
      totalPaidAmount,
      payableCount,
      advisorCount: advisors.size,
      avgRate: totalPaidAmount ? Math.round((totalCommission / totalPaidAmount * 100) * 100) / 100 : 0,
    };
  }, [filteredRows]);

  const advisorRows = useMemo(() => summarizeRows(filteredRows, row => ({ key: row.advisor, advisor: row.advisor })), [filteredRows]);
  const monthlyRows = useMemo(() => summarizeRows(filteredRows, row => ({ key: `${row.month}-${row.advisor}`, advisor: row.advisor, period: row.month }))
    .map(row => ({ ...row, settled: isSettled(row.advisor, row.period || '') }))
    .sort((a, b) => (
      compareTableValues(b.period || '', a.period || '')
      || compareTableValues(a.advisor, b.advisor)
      || compareTableValues(b.commission, a.commission)
    )), [filteredRows, settledKeys]);
  const yearlyRows = useMemo(() => summarizeRows(filteredRows, row => ({ key: `${row.year}-${row.advisor}`, advisor: row.advisor, period: row.year })), [filteredRows]);

  const toggleSettlement = async (row: SummaryRow) => {
    if (!row.period) return;
    const nextStatus = row.settled ? 'unsettled' : 'settled';
    setSavingSettlementKey(row.key);
    try {
      await trainingApi.updateCommissionSettlement({ advisor: row.advisor, period: row.period, status: nextStatus });
      message.success(nextStatus === 'settled' ? '该月提成已结清' : '该月提成已取消结清');
      const settlementRows = await trainingApi.getCommissionSettlements();
      setSettlements(settlementRows);
    } catch (error: any) {
      message.error(error?.response?.data?.error || error?.message || '结清状态保存失败');
    } finally {
      setSavingSettlementKey('');
    }
  };

  const summaryColumns = (periodTitle?: string, withSettlement = false, defaultPeriodSortOrder?: 'ascend' | 'descend') => [
    { title: '课程顾问', dataIndex: 'advisor', width: 140, render: (value: string) => <Text strong>{value}</Text> },
    ...(periodTitle ? [{
      title: periodTitle,
      dataIndex: 'period',
      width: 110,
      defaultSortOrder: defaultPeriodSortOrder,
      sorter: (a: SummaryRow, b: SummaryRow) => compareTableValues(a.period || '', b.period || ''),
      render: (value: string) => value || '-',
    }] : []),
    { title: '缴费笔数', dataIndex: 'paymentCount', align: 'right' as const, width: 100, sorter: (a: SummaryRow, b: SummaryRow) => compareTableValues(a.paymentCount, b.paymentCount) },
    { title: '实付金额', dataIndex: 'paidAmount', align: 'right' as const, width: 120, sorter: (a: SummaryRow, b: SummaryRow) => compareTableValues(a.paidAmount, b.paidAmount), render: money },
    { title: '提成金额', dataIndex: 'commission', align: 'right' as const, width: 130, sorter: (a: SummaryRow, b: SummaryRow) => compareTableValues(a.commission, b.commission), render: (value: number) => <Text strong style={{ color: '#F72A8A' }}>{money(value)}</Text> },
    ...(withSettlement ? [{
      title: '结清状态',
      dataIndex: 'settled',
      align: 'center' as const,
      width: 120,
      render: (_: unknown, row: SummaryRow) => (
        <Popconfirm
          title={row.settled ? '取消该月结清？' : '确认该月已结清？'}
          description={row.settled ? '取消后相关缴费记录可继续编辑。' : '结清后除超级管理员外，相关缴费和提成记录不可再编辑。'}
          okText="确定"
          cancelText="取消"
          onConfirm={() => toggleSettlement(row)}
        >
          <Button
            size="small"
            type={row.settled ? 'primary' : 'default'}
            icon={row.settled ? <LockOutlined /> : <UnlockOutlined />}
            disabled={!isSuperAdmin}
            loading={savingSettlementKey === row.key}
          >
            {row.settled ? '已结清' : '未结清'}
          </Button>
        </Popconfirm>
      ),
    }] : []),
  ];

  const detailColumns = sortableColumns<CommissionDetailRow>([
    { title: '来源', width: 100, render: (_: unknown, row: CommissionDetailRow) => row.source === 'online' ? <Link href="/online-course/auth">线上授权</Link> : '线下缴费' },
    { title: '缴费日期', dataIndex: 'date', width: 110, render: dateText },
    { title: '课程顾问', dataIndex: 'advisor', width: 130, render: value => <Tag color={value === '未填写顾问' ? 'default' : 'magenta'}>{value}</Tag> },
    { title: '学员', dataIndex: 'memberName', width: 120, render: value => value || '-' },
    { title: '手机号', dataIndex: 'memberPhone', width: 130, render: value => value || '-' },
    { title: '课程', dataIndex: 'courseName', width: 220, ellipsis: true, render: value => value || '-' },
    { title: '课程期次', dataIndex: 'courseSubType', width: 120, render: value => value || '-' },
    { title: '实付金额', dataIndex: 'paidAmount', align: 'right' as const, width: 120, render: money },
    { title: '提成比例', dataIndex: 'rate', align: 'right' as const, width: 110, render: value => `${numberValue(value)}%` },
    { title: '提成金额', dataIndex: 'commission', align: 'right' as const, width: 120, render: value => <Text strong style={{ color: '#F72A8A' }}>{money(value)}</Text> },
    { title: '备注', dataIndex: 'remark', width: 180, ellipsis: true, render: value => value || '-' },
  ]);

  if (loadError) {
    return <div className="bonus-commission-page"><Title level={2}>奖金提成</Title><Alert type="error" showIcon message="提成数据加载失败" description={loadError} action={<Button onClick={loadPayments}>重新加载</Button>} /></div>;
  }

  if (loading) {
    return <Spin style={{ width: '100%', marginTop: 120 }} />;
  }

  return (
    <div className="bonus-commission-page">
      <div className="page-header">
        <div>
          <Title level={2} style={{ marginBottom: 4 }}>奖金提成</Title>
          <Text type="secondary">按课程顾问合并统计线上授权与线下课程缴费提成，支持明细、月度和年度汇总。</Text>
        </div>
      </div>

      <Card style={{ marginBottom: 12 }} styles={{ body: { padding: 14 } }}>
        <Row gutter={[12, 8]} style={{ marginBottom: 12 }}>
          <Col xs={12} md={6}>
            <Statistic title="提成总额" value={formatCompactMoney(dashboard.totalCommission)} prefix={<TrophyOutlined />} valueStyle={{ color: '#F72A8A', fontSize: 20 }} />
          </Col>
          <Col xs={12} md={6}>
            <Statistic title="关联实付金额" value={formatCompactMoney(dashboard.totalPaidAmount)} prefix={<DollarOutlined />} valueStyle={{ fontSize: 20 }} />
          </Col>
          <Col xs={12} md={6}>
            <Statistic title="顾问人数" value={dashboard.advisorCount} suffix="人" prefix={<TeamOutlined />} valueStyle={{ fontSize: 20 }} />
          </Col>
          <Col xs={12} md={6}>
            <Statistic title="平均提成比例" value={dashboard.avgRate} suffix="%" prefix={<BarChartOutlined />} valueStyle={{ fontSize: 20 }} />
          </Col>
        </Row>
        <Row gutter={[12, 8]} align="middle">
          <Col xs={24} md={10}>
            <Input prefix={<SearchOutlined />} allowClear placeholder="搜索顾问、学员、手机号、课程" value={keyword} onChange={event => setKeyword(event.target.value)} />
          </Col>
          <Col xs={12} md={5}>
            <Select
              style={{ width: '100%' }}
              aria-label="课程顾问"
              value={advisorFilter}
              onChange={setAdvisorFilter}
              options={advisorSelectOptions}
            />
          </Col>
          <Col xs={12} md={5}>
            <Select
              style={{ width: '100%' }}
              aria-label="年份"
              value={yearFilter}
              onChange={setYearFilter}
              options={yearOptions.map(value => ({ value, label: value === 'all' ? '全部年份' : value }))}
            />
          </Col>
          <Col xs={24} md={4}>
            <Text type="secondary">共 {filteredRows.length} 条提成记录</Text>
          </Col>
        </Row>
      </Card>

      <Tabs
        defaultActiveKey="detail"
        items={[
          {
            key: 'detail',
            label: `提成详单 ${filteredRows.length}`,
            children: (
              <Card styles={{ body: { padding: 0 } }}>
                <Table<CommissionDetailRow>
                  rowKey={row => `${row.source || 'offline'}-${row.id}`}
                  size="middle"
                  dataSource={filteredRows}
                  columns={detailColumns}
                  scroll={{ x: 1460, y: MAIN_TABLE_SCROLL_Y }}
                  pagination={{ pageSize: 20, showSizeChanger: true }}
                  locale={{ emptyText: <Empty description="暂无提成详单" /> }}
                  onRow={(record) => ({
                    onClick: () => openPaymentEdit(record),
                    style: { cursor: isSettled(record.advisor, record.month) && !isSuperAdmin ? 'not-allowed' : 'pointer' },
                  })}
                />
              </Card>
            ),
          },
          {
            key: 'advisor',
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
            key: 'month',
            label: `月度统计 ${monthlyRows.length}`,
            children: (
              <Card styles={{ body: { padding: 0 } }}>
                <Table<SummaryRow>
                  rowKey="key"
                  size="middle"
                  dataSource={monthlyRows}
                  columns={sortableColumns<SummaryRow>(summaryColumns('月份', true, 'descend'))}
                  scroll={{ x: 860, y: MAIN_TABLE_SCROLL_Y }}
                  pagination={{ pageSize: 20, showSizeChanger: true }}
                  locale={{ emptyText: <Empty description="暂无月度统计" /> }}
                />
              </Card>
            ),
          },
          {
            key: 'year',
            label: `年度统计 ${yearlyRows.length}`,
            children: (
              <Card styles={{ body: { padding: 0 } }}>
                <Table<SummaryRow>
                  rowKey="key"
                  size="middle"
                  dataSource={yearlyRows}
                  columns={sortableColumns<SummaryRow>(summaryColumns('年份'))}
                  scroll={{ x: 860, y: MAIN_TABLE_SCROLL_Y }}
                  pagination={{ pageSize: 20, showSizeChanger: true }}
                  locale={{ emptyText: <Empty description="暂无年度统计" /> }}
                />
              </Card>
            ),
          },

        ]}
        tabBarExtraContent={<Space><FileSearchOutlined /><Text type="secondary">线上授权与线下缴费合并统计</Text><CalendarOutlined /></Space>}
      />

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
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Descriptions size="small" bordered column={2}>
              <Descriptions.Item label="学员">{editingPayment.memberName || '-'}</Descriptions.Item>
              <Descriptions.Item label="手机号">{editingPayment.memberPhone || '-'}</Descriptions.Item>
              <Descriptions.Item label="课程">{editingPayment.courseName || '-'}</Descriptions.Item>
              <Descriptions.Item label="课程期次">{editingPayment.courseSubType || '-'}</Descriptions.Item>
            </Descriptions>
            <Form form={editForm} layout="vertical">
              <Row gutter={[12, 0]}>
                <Col xs={24} md={8}>
                  <Form.Item name="date" label="缴费日期" rules={[{ required: true, message: '请选择缴费日期' }]}>
                    <DatePicker style={{ width: '100%' }} />
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
                  <Form.Item name="amount" label="实付金额" rules={[{ required: true, message: '请输入实付金额' }]}>
                    <InputNumber min={0} precision={2} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="commissionRate" label="提成比例">
                    <InputNumber min={0} max={100} precision={2} suffix="%" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="commissionAmount" label="提成金额">
                    <InputNumber disabled precision={2} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="remainingSessions" label="剩余课时">
                    <InputNumber min={0} precision={0} style={{ width: '100%' }} />
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
