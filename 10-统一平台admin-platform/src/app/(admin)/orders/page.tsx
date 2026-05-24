'use client';
import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, DatePicker, Empty, Input, Row, Select, Space, Spin, Statistic, Table, Tabs, Tag, Typography } from 'antd';
import { DownloadOutlined, ReloadOutlined, SearchOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import { platformAdapter } from '@/lib/adapters/platform';
import type { UnifiedOrder } from '@/types/domain';

const { RangePicker } = DatePicker;
const { Text, Title } = Typography;

function money(value: number) {
  return `¥${Number(value || 0).toLocaleString()}`;
}

function orderTypeLabel(value: string) {
  const map: Record<string, string> = {
    course: '线上课程',
    live: '直播',
    training: '线下培训',
    masterclass: '大师课',
    event: '活动',
    competition: '赛事',
    shop: '电商商品',
    membership: '会员',
    finance: '财务订单',
  };
  return map[value] || value || '-';
}

function statusColor(value: string) {
  if (['paid', 'completed', '已支付', '已完成'].includes(value)) return 'green';
  if (['pending', '待支付', '待付款'].includes(value)) return 'orange';
  if (['refunded', '已退款'].includes(value)) return 'blue';
  if (['closed', '已关闭'].includes(value)) return 'default';
  return 'purple';
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<UnifiedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [type, setType] = useState('all');
  const [tab, setTab] = useState('all');

  const load = () => {
    setLoading(true);
    platformAdapter.getOrders()
      .then(setOrders)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return orders.filter(order => {
      const matchKeyword = !q || [order.orderNo, order.memberName, order.memberPhone, order.title].some(value => value.toLowerCase().includes(q));
      const matchType = type === 'all' || order.orderType === type;
      const matchTab = tab === 'all' || order.status === tab;
      return matchKeyword && matchType && matchTab;
    });
  }, [orders, keyword, type, tab]);

  const types = useMemo(() => ['all', ...Array.from(new Set(orders.map(item => item.orderType).filter(Boolean)))], [orders]);
  const totalAmount = orders.reduce((sum, item) => sum + item.amount, 0);

  if (loading) return <div style={{ padding: 80, textAlign: 'center' }}><Spin size="large" /></div>;

  return (
    <div>
      <div className="page-header">
        <Title level={2}>订单中心</Title>
        <Text type="secondary">统一聚合线下缴费、网课订单、电商订单和财务订单。</Text>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={6}><Card><Statistic title="全部订单" value={orders.length} prefix={<ShoppingCartOutlined />} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="订单总额" value={totalAmount} prefix="¥" valueStyle={{ color: '#F72A8A' }} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="已完成" value={orders.filter(item => ['paid', 'completed'].includes(item.status)).length} valueStyle={{ color: '#22C55E' }} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="待处理" value={orders.filter(item => item.status === 'pending').length} valueStyle={{ color: '#F59E0B' }} /></Card></Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} lg={8}><Input prefix={<SearchOutlined />} placeholder="搜索订单号、会员、手机号、内容" value={keyword} onChange={event => setKeyword(event.target.value)} allowClear /></Col>
          <Col xs={24} md={6}><Select value={type} onChange={setType} style={{ width: '100%' }} options={types.map(item => ({ value: item, label: item === 'all' ? '全部类型' : orderTypeLabel(item) }))} /></Col>
          <Col xs={24} md={6}><RangePicker style={{ width: '100%' }} /></Col>
          <Col xs={24} md={4} style={{ textAlign: 'right' }}><Space><Button icon={<ReloadOutlined />} onClick={load}>刷新</Button><Button icon={<DownloadOutlined />}>导出</Button></Space></Col>
        </Row>
      </Card>

      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          { key: 'all', label: `全部 ${orders.length}` },
          { key: 'pending', label: `待处理 ${orders.filter(item => item.status === 'pending').length}` },
          { key: 'paid', label: `已支付 ${orders.filter(item => item.status === 'paid').length}` },
          { key: 'completed', label: `已完成 ${orders.filter(item => item.status === 'completed').length}` },
          { key: 'refunded', label: `退款 ${orders.filter(item => item.status === 'refunded').length}` },
        ]}
      />

      <Card bodyStyle={{ padding: 0 }}>
        <Table
          rowKey="id"
          size="middle"
          dataSource={filtered}
          scroll={{ x: 1100 }}
          pagination={{ pageSize: 15, showSizeChanger: true, showTotal: total => `共 ${total} 条订单` }}
          locale={{ emptyText: <Empty description="暂无订单数据" /> }}
          columns={[
            { title: '订单号', dataIndex: 'orderNo', fixed: 'left', width: 170, render: value => <Text strong>{value}</Text> },
            { title: '会员', dataIndex: 'memberName', width: 130 },
            { title: '手机号', dataIndex: 'memberPhone', width: 130 },
            { title: '类型', dataIndex: 'orderType', width: 120, render: value => <Tag color="magenta">{orderTypeLabel(value)}</Tag> },
            { title: '内容', dataIndex: 'title', ellipsis: true, width: 240 },
            { title: '金额', dataIndex: 'amount', align: 'right' as const, width: 120, render: value => <Text strong style={{ color: '#F72A8A' }}>{money(value)}</Text> },
            { title: '状态', dataIndex: 'status', width: 110, render: value => <Tag color={statusColor(value)}>{value}</Tag> },
            { title: '来源', dataIndex: 'sourceType', width: 140 },
            { title: '日期', dataIndex: 'orderDate', width: 120 },
          ]}
        />
      </Card>
    </div>
  );
}
