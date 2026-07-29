'use client';
import { useState } from 'react';
import { Card, Tag, Badge, Space, Button, Input, Select, DatePicker, Row, Col, Statistic, Tabs, Modal, Descriptions, Steps, message } from 'antd';
import { Table } from '@/components/adaptive-table';
import { SearchOutlined, ReloadOutlined, DownloadOutlined, EyeOutlined, CheckCircleOutlined, CloseCircleOutlined, SyncOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { formatCompactMoney, formatPaymentAmount } from '@/lib/money-format';
import { sortableColumns } from '@/lib/table-sort';

const { RangePicker } = DatePicker;

// Mock orders data
const mockOrders = Array.from({ length: 48 }, (_, i) => {
  const types = ['course', 'ecommerce', 'offline', 'event'] as const;
  const typeLabels: Record<string, string> = { course: '课程订单', ecommerce: '电商订单', offline: '线下培训', event: '赛事报名' };
  const statuses = ['completed', 'pending', 'processing', 'cancelled', 'refunding'] as const;
  const statusLabels: Record<string, { label: string; color: string }> = {
    completed: { label: '已完成', color: 'success' },
    pending: { label: '待支付', color: 'warning' },
    processing: { label: '处理中', color: 'processing' },
    cancelled: { label: '已取消', color: 'default' },
    refunding: { label: '退款中', color: 'error' },
  };
  const type = types[i % 4];
  const status = statuses[i % 5];
  const amount = [199, 299, 499, 799, 1299, 2580, 3980, 5999, 89, 159][i % 10];
  const isPaid = status === 'completed' || status === 'processing';

  return {
    key: String(1000 + i),
    orderNo: `ORD${String(20260523001 + i)}`,
    memberName: ['李梅', '张华', '王芳', '赵丽', '陈静', '刘洋', '周敏', '吴丹', '郑倩', '林雪'][i % 10],
    memberPhone: `1380013${String(8000 + i).slice(-4)}`,
    type,
    typeLabel: typeLabels[type],
    title: [
      '埃及东方舞系统课·入门', '埃及东方舞舞码集·中级',
      '伊娃老师·大师集训营', '东方舞师资班·高级',
      '表演舞码《沙漠玫瑰》', '纱巾舞技巧专攻',
      '藤杖舞基础训练', '2026夏季舞蹈赛事',
      '埃及节奏与音乐解析', '东方舞文化理论课'
    ][i % 10],
    amount,
    paidAmount: isPaid ? amount : 0,
    status,
    statusLabel: statusLabels[status],
    payMethod: isPaid ? (['wechat', 'alipay', 'bank', 'cash'][i % 4]) : '-',
    createdAt: `2026-05-${String(10 + (i % 20)).padStart(2, '0')} ${String(8 + (i % 10)).padStart(2, '0')}:${String(30 + (i % 30)).padStart(2, '0')}`,
    paidAt: isPaid ? `2026-05-${String(10 + (i % 20)).padStart(2, '0')} ${String(9 + (i % 10)).padStart(2, '0')}:${String(0 + (i % 30)).padStart(2, '0')}` : '-',
  };
});

const statusFilter = [
  { text: '全部', value: '' },
  { text: '已完成', value: 'completed' },
  { text: '待支付', value: 'pending' },
  { text: '处理中', value: 'processing' },
  { text: '已取消', value: 'cancelled' },
  { text: '退款中', value: 'refunding' },
];

const typeFilter = [
  { text: '全部', value: '' },
  { text: '课程订单', value: 'course' },
  { text: '电商订单', value: 'ecommerce' },
  { text: '线下培训', value: 'offline' },
  { text: '赛事报名', value: 'event' },
];

export default function OrderCenterPage() {
  const [searchText, setSearchText] = useState('');
  const [statusFilterVal, setStatusFilterVal] = useState<string>('');
  const [typeFilterVal, setTypeFilterVal] = useState<string>('');
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailOrder, setDetailOrder] = useState<any>(null);

  const filtered = mockOrders.filter(o => {
    if (searchText && !o.orderNo.includes(searchText) && !o.memberName.includes(searchText) && !o.memberPhone.includes(searchText)) return false;
    if (statusFilterVal && o.status !== statusFilterVal) return false;
    if (typeFilterVal && o.type !== typeFilterVal) return false;
    return true;
  });

  const stats = {
    total: mockOrders.length,
    completed: mockOrders.filter(o => o.status === 'completed').length,
    pending: mockOrders.filter(o => o.status === 'pending').length,
    revenue: mockOrders.filter(o => o.status === 'completed').reduce((s, o) => s + o.amount, 0),
  };

  const showDetail = (order: any) => {
    setDetailOrder(order);
    setDetailVisible(true);
  };

  const columns = sortableColumns<any>([
    { title: '订单号', dataIndex: 'orderNo', key: 'orderNo', width: 160, render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span> },
    { title: '类型', dataIndex: 'typeLabel', key: 'type', width: 100, render: (v: string, r: any) => <Tag>{v}</Tag> },
    { title: '学员', key: 'member', width: 130, render: (_: any, r: any) => <>{r.memberName}<br /><span style={{ fontSize: 11, color: '#999' }}>{r.memberPhone}</span></> },
    { title: '商品', dataIndex: 'title', key: 'title', ellipsis: true },
    { title: '金额', dataIndex: 'amount', key: 'amount', width: 100, align: 'right' as const,
      render: (v: number) => <span style={{ fontWeight: 600 }}>{formatPaymentAmount(v)}</span> },
    { title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: (_: any, r: any) => <Tag color={r.statusLabel.color}>{r.statusLabel.label}</Tag> },
    { title: '支付方式', dataIndex: 'payMethod', key: 'payMethod', width: 90,
      render: (v: string) => ({ wechat: '微信', alipay: '支付宝', bank: '银行转账', cash: '现金', '-': '-' })[v] || '-' },
    { title: '下单时间', dataIndex: 'createdAt', key: 'createdAt', width: 150, render: (v: string) => <span style={{ fontSize: 12, color: '#666' }}>{v}</span> },
    { title: '操作', key: 'action', width: 80, fixed: 'right' as const,
      render: (_: any, r: any) => <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => showDetail(r)}>详情</Button> },
  ]);

  return (
    <div>
      <h2 style={{ marginBottom: 16, color: '#1f2937' }}>订单中心</h2>

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title="总订单" value={stats.total} suffix="笔" /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="已完成" value={stats.completed} suffix="笔" valueStyle={{ color: '#10b981' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="待处理" value={stats.pending} suffix="笔" valueStyle={{ color: '#f59e0b' }} prefix={<ClockCircleOutlined />} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="总营收" value={formatCompactMoney(stats.revenue)} valueStyle={{ color: '#a855f7' }} /></Card></Col>
      </Row>

      {/* Filters */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input placeholder="搜索订单号/学员/手机号" prefix={<SearchOutlined />} style={{ width: 240 }}
            value={searchText} onChange={e => setSearchText(e.target.value)} allowClear />
          <Select placeholder="订单状态" style={{ width: 120 }} value={statusFilterVal || undefined}
            onChange={v => setStatusFilterVal(v || '')} allowClear
            options={statusFilter.slice(1).map(s => ({ label: s.text, value: s.value }))} />
          <Select placeholder="订单类型" style={{ width: 120 }} value={typeFilterVal || undefined}
            onChange={v => setTypeFilterVal(v || '')} allowClear
            options={typeFilter.slice(1).map(s => ({ label: s.text, value: s.value }))} />
          <RangePicker style={{ width: 220 }} />
          <Button icon={<ReloadOutlined />}>重置</Button>
          <Button icon={<DownloadOutlined />}>导出</Button>
        </Space>
      </Card>

      {/* Table */}
      <Table columns={columns} dataSource={filtered} scroll={{ x: 1100 }} size="middle"
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: t => `共 ${t} 条` }} />

      {/* Detail Modal */}
      <Modal title={`订单详情 - ${detailOrder?.orderNo || ''}`} open={detailVisible}
        onCancel={() => setDetailVisible(false)} footer={null} width={720}>
        {detailOrder && (
          <div>
            <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="订单号">{detailOrder.orderNo}</Descriptions.Item>
              <Descriptions.Item label="订单类型">{detailOrder.typeLabel}</Descriptions.Item>
              <Descriptions.Item label="学员姓名">{detailOrder.memberName}</Descriptions.Item>
              <Descriptions.Item label="学员手机">{detailOrder.memberPhone}</Descriptions.Item>
              <Descriptions.Item label="商品">{detailOrder.title}</Descriptions.Item>
              <Descriptions.Item label="金额"><span style={{ fontWeight: 600, color: '#a855f7' }}>{formatPaymentAmount(detailOrder.amount)}</span></Descriptions.Item>
              <Descriptions.Item label="实付">
                <span style={{ fontWeight: 600, color: detailOrder.paidAmount > 0 ? '#10b981' : '#999' }}>
                  {formatPaymentAmount(detailOrder.paidAmount)}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="状态"><Tag color={detailOrder.statusLabel.color}>{detailOrder.statusLabel.label}</Tag></Descriptions.Item>
              <Descriptions.Item label="支付方式">{detailOrder.payMethod === '-' ? '未支付' : detailOrder.payMethod}</Descriptions.Item>
              <Descriptions.Item label="下单时间">{detailOrder.createdAt}</Descriptions.Item>
              <Descriptions.Item label="支付时间">{detailOrder.paidAt}</Descriptions.Item>
            </Descriptions>
            <Steps size="small" current={['pending', 'processing', 'completed'].indexOf(detailOrder.status) >= 0 ? ['pending', 'processing', 'completed'].indexOf(detailOrder.status) : 0}
              items={[
                { title: '提交订单', description: detailOrder.createdAt },
                { title: '支付确认', description: detailOrder.paidAt !== '-' ? detailOrder.paidAt : '等待支付' },
                { title: '完成', description: detailOrder.status === 'completed' ? '已完成' : detailOrder.status === 'cancelled' ? '已取消' : '进行中' },
              ]} />
          </div>
        )}
      </Modal>
    </div>
  );
}
