'use client';

import { useEffect, useMemo, useState } from 'react';
import { App, Button, Card, Col, DatePicker, Empty, Form, Input, InputNumber, Modal, Row, Select, Space, Spin, Statistic, Tag, Typography } from 'antd';
import { Table } from '@/components/adaptive-table';
import { BarChartOutlined, CalendarOutlined, DollarOutlined, SearchOutlined, TeamOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { api } from '@/lib/api';
import { formatPaymentAmount } from '@/lib/money-format';
import { adminTablePagination, sortableColumns } from '@/lib/table-sort';

const { Text, Title } = Typography;

type CommissionTotals = {
  totalCommission: number;
  monthCommission: number;
  yearCommission: number;
  advisorCount: number;
  detailCount: number;
};

type AdvisorSummary = {
  advisor: string;
  paymentCount: number;
  paymentAmount: number;
  commissionAmount: number;
  monthCommission: number;
  yearCommission: number;
  averageRate: number;
  latestDate: string;
};

type CommissionDetail = {
  id: number;
  advisor: string;
  memberName: string;
  memberPhone: string;
  courseName: string;
  courseSubType: string;
  paymentAmount: number;
  commissionRate: number;
  commissionAmount: number;
  paymentMethod: string;
  date: string;
  remark: string;
};

type CommissionResponse = {
  month: string;
  year: string;
  totals: CommissionTotals;
  advisors: AdvisorSummary[];
  details: CommissionDetail[];
};

function money(value: unknown) {
  return formatPaymentAmount(Number(value || 0));
}

function currentMonthKey() {
  return dayjs().format('YYYY-MM');
}

function currentYearKey() {
  return dayjs().format('YYYY');
}

export default function CommissionPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [month, setMonth] = useState(currentMonthKey());
  const [year, setYear] = useState(currentYearKey());
  const [advisorFilter, setAdvisorFilter] = useState('all');
  const [detailKeyword, setDetailKeyword] = useState('');
  const [editingDetail, setEditingDetail] = useState<CommissionDetail | null>(null);
  const [data, setData] = useState<CommissionResponse>({
    month: currentMonthKey(),
    year: currentYearKey(),
    totals: { totalCommission: 0, monthCommission: 0, yearCommission: 0, advisorCount: 0, detailCount: 0 },
    advisors: [],
    details: [],
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/finance/commissions', { params: { month, year } });
      setData(res.data);
    } catch (error: any) {
      message.error(error?.response?.data?.error || '奖金提成统计加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [month, year]);

  const advisorOptions = useMemo(() => [
    { label: '全部顾问', value: 'all' },
    ...data.advisors.map(item => ({ label: item.advisor, value: item.advisor })),
  ], [data.advisors]);

  const detailRows = useMemo(() => (
    data.details.filter(row => advisorFilter === 'all' || row.advisor === advisorFilter)
  ), [advisorFilter, data.details]);

  const filteredDetailRows = useMemo(() => {
    const keyword = detailKeyword.trim().toLowerCase();
    if (!keyword) return detailRows;
    return detailRows.filter(row => {
      const searchable = [
        row.date,
        row.advisor,
        row.memberName,
        row.memberPhone,
        row.courseName,
        row.courseSubType,
        row.remark,
        String(row.paymentAmount ?? ''),
        String(row.commissionRate ?? ''),
        String(row.commissionAmount ?? ''),
      ].join(' ').toLowerCase();
      return searchable.includes(keyword);
    });
  }, [detailKeyword, detailRows]);

  const monthDetailRows = useMemo(() => (
    detailRows.filter(row => row.date.startsWith(month))
  ), [detailRows, month]);

  const yearDetailRows = useMemo(() => (
    detailRows.filter(row => row.date.startsWith(year))
  ), [detailRows, year]);

  const monthAdvisorRows = useMemo(() => (
    data.advisors
      .filter(row => advisorFilter === 'all' || row.advisor === advisorFilter)
  ), [advisorFilter, data.advisors]);

  const openDetailModal = (record: CommissionDetail) => {
    setEditingDetail(record);
    form.setFieldsValue({
      advisor: record.advisor === '未填写' ? '' : record.advisor,
      memberName: record.memberName,
      memberPhone: record.memberPhone,
      courseName: record.courseName,
      courseSubType: record.courseSubType,
      date: record.date ? dayjs(record.date) : dayjs(),
      paymentAmount: Number(record.paymentAmount || 0),
      commissionRate: Number(record.commissionRate || 0),
      commissionAmount: Number(record.commissionAmount || 0),
      remark: record.remark,
    });
  };

  const saveDetail = async () => {
    if (!editingDetail) return;
    const values = await form.validateFields();
    const amount = Number(values.paymentAmount || 0);
    const rate = Math.min(100, Math.max(0, Number(values.commissionRate || 0)));
    setSaving(true);
    try {
      await api.patch(`/finance/commissions/${editingDetail.id}`, {
        date: values.date ? dayjs(values.date).format('YYYY-MM-DD') : editingDetail.date,
        sales: values.advisor || '',
        amount,
        commissionRate: rate,
        remark: values.remark || '',
      });
      message.success('提成信息已保存');
      setEditingDetail(null);
      await loadData();
    } catch (error: any) {
      message.error(error?.response?.data?.error || '提成信息保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="finance-admin-page commission-admin-page">
      <div className="page-header finance-page-header">
        <div>
          <Title level={2}>奖金提成</Title>
          <Text type="secondary">统计课程顾问老师的提成，本月、本年、累计和每笔缴费明细。</Text>
        </div>
        <Space wrap>
          <DatePicker
            picker="month"
            value={dayjs(month)}
            allowClear={false}
            onChange={(value: Dayjs | null) => value && setMonth(value.format('YYYY-MM'))}
          />
          <DatePicker
            picker="year"
            value={dayjs(year)}
            allowClear={false}
            onChange={(value: Dayjs | null) => value && setYear(value.format('YYYY'))}
          />
          <Select value={advisorFilter} options={advisorOptions} onChange={setAdvisorFilter} style={{ width: 140 }} />
        </Space>
      </div>

      <Spin spinning={loading}>
        <Row className="finance-summary-grid finance-summary-grid-primary" gutter={[12, 12]} style={{ marginBottom: 12 }}>
          <Col xs={24} md={6}><Card className="finance-stat-card"><Statistic title="本月提成" value={money(monthDetailRows.reduce((sum, row) => sum + row.commissionAmount, 0))} prefix={<DollarOutlined />} valueStyle={{ color: '#16A34A' }} /></Card></Col>
          <Col xs={24} md={6}><Card className="finance-stat-card"><Statistic title="本年提成" value={money(yearDetailRows.reduce((sum, row) => sum + row.commissionAmount, 0))} prefix={<CalendarOutlined />} valueStyle={{ color: '#2563EB' }} /></Card></Col>
          <Col xs={24} md={6}><Card className="finance-stat-card"><Statistic title="累计提成" value={money(detailRows.reduce((sum, row) => sum + row.commissionAmount, 0))} prefix={<BarChartOutlined />} valueStyle={{ color: '#7C3AED' }} /></Card></Col>
          <Col xs={24} md={6}><Card className="finance-stat-card"><Statistic title="顾问人数" value={advisorFilter === 'all' ? data.totals.advisorCount : 1} suffix="人" prefix={<TeamOutlined />} /></Card></Col>
        </Row>

        <Card title="课程顾问提成汇总" style={{ marginBottom: 16 }} styles={{ body: { padding: 0 } }}>
          <Table<AdvisorSummary>
            rowKey="advisor"
            size="middle"
            dataSource={monthAdvisorRows}
            pagination={adminTablePagination()}
            locale={{ emptyText: <Empty description="暂无提成汇总" /> }}
            columns={sortableColumns<AdvisorSummary>([
              { title: '课程顾问', dataIndex: 'advisor', width: 140, render: value => <Text strong>{value}</Text> },
              { title: '缴费笔数', dataIndex: 'paymentCount', width: 100 },
              { title: '缴费金额', dataIndex: 'paymentAmount', width: 130, align: 'right' as const, render: money },
              { title: '平均比例', dataIndex: 'averageRate', width: 110, render: value => <Text>{Number(value || 0)}%</Text> },
              { title: '本月提成', dataIndex: 'monthCommission', width: 130, align: 'right' as const, render: value => <Text strong style={{ color: '#16A34A' }}>{money(value)}</Text> },
              { title: '本年提成', dataIndex: 'yearCommission', width: 130, align: 'right' as const, render: value => <Text strong style={{ color: '#2563EB' }}>{money(value)}</Text> },
              { title: '累计提成', dataIndex: 'commissionAmount', width: 130, align: 'right' as const, render: value => <Text strong>{money(value)}</Text> },
              { title: '最近缴费', dataIndex: 'latestDate', width: 120 },
            ])}
          />
        </Card>

        <Card
          title={`提成明细 ${filteredDetailRows.length}`}
          extra={
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="搜索明细"
              value={detailKeyword}
              onChange={event => setDetailKeyword(event.target.value)}
              style={{ width: 260 }}
            />
          }
          styles={{ body: { padding: 0 } }}
        >
          <Table<CommissionDetail>
            rowKey="id"
            size="middle"
            scroll={{ x: 'max-content' }}
            dataSource={filteredDetailRows}
            pagination={adminTablePagination()}
            locale={{ emptyText: <Empty description="暂无提成明细" /> }}
            onRow={(record) => ({
              onClick: () => openDetailModal(record),
              style: { cursor: 'pointer' },
            })}
            columns={sortableColumns<CommissionDetail>([
              { title: '日期', dataIndex: 'date', width: 120 },
              { title: '课程顾问', dataIndex: 'advisor', width: 130, render: value => value || '-' },
              { title: '学员', dataIndex: 'memberName', width: 120, ellipsis: true, render: value => value || '-' },
              { title: '手机号', dataIndex: 'memberPhone', width: 130, render: value => value || '-' },
              { title: '课程', dataIndex: 'courseName', width: 220, ellipsis: true },
              { title: '期次', dataIndex: 'courseSubType', width: 120, render: value => value || '-' },
              { title: '实付金额', dataIndex: 'paymentAmount', width: 120, align: 'right' as const, render: money },
              { title: '提成比例', dataIndex: 'commissionRate', width: 100, render: value => `${Number(value || 0)}%` },
              { title: '提成金额', dataIndex: 'commissionAmount', width: 120, align: 'right' as const, render: value => <Text strong style={{ color: '#F72A8A' }}>{money(value)}</Text> },
              { title: '备注', dataIndex: 'remark', width: 180, ellipsis: true, render: value => value || '-' },
            ])}
          />
        </Card>
      </Spin>

      <Modal
        title="编辑提成明细"
        open={Boolean(editingDetail)}
        onCancel={() => setEditingDetail(null)}
        onOk={saveDetail}
        confirmLoading={saving}
        width={680}
        destroyOnClose
        footer={[
          <Button key="cancel" onClick={() => setEditingDetail(null)}>取消</Button>,
          <Button key="save" type="primary" loading={saving} onClick={saveDetail}>保存</Button>,
        ]}
      >
        <Form
          form={form}
          layout="vertical"
          onValuesChange={(_, values) => {
            const amount = Number(values.paymentAmount || 0);
            const rate = Math.min(100, Math.max(0, Number(values.commissionRate || 0)));
            form.setFieldValue('commissionAmount', Math.round(amount * rate) / 100);
          }}
        >
          <Row gutter={12}>
            <Col xs={24} md={12}><Form.Item label="学员"><Input value={editingDetail?.memberName || ''} disabled /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item label="手机号"><Input value={editingDetail?.memberPhone || ''} disabled /></Form.Item></Col>
            <Col xs={24}><Form.Item label="课程"><Input value={editingDetail?.courseName || ''} disabled /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item label="期次"><Input value={editingDetail?.courseSubType || ''} disabled /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="date" label="缴费日期" rules={[{ required: true, message: '请选择缴费日期' }]}><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="advisor" label="课程顾问"><Input placeholder="填写课程顾问姓名" /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="paymentAmount" label="实付金额" rules={[{ required: true, message: '请输入实付金额' }]}><InputNumber min={0} precision={2} style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="commissionRate" label="提成比例"><InputNumber min={0} max={100} precision={2} addonAfter="%" style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="commissionAmount" label="提成金额"><InputNumber min={0} precision={2} prefix="¥" disabled style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={24}><Form.Item name="remark" label="备注"><Input.TextArea rows={3} placeholder="填写备注" /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}
