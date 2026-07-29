'use client';
import { useEffect, useMemo, useState } from 'react';
import { Avatar, Card, Col, Empty, List, Row, Space, Spin, Statistic, Tag, Typography } from 'antd';
import { Table } from '@/components/adaptive-table';
import {
  BarChartOutlined, DollarOutlined, OrderedListOutlined, ShopOutlined,
  TeamOutlined, UserOutlined,
} from '@ant-design/icons';
import dynamic from 'next/dynamic';
import { platformAdapter } from '@/lib/adapters/platform';
import { formatCompactMoney, formatPaymentAmount } from '@/lib/money-format';
import { sortableColumns } from '@/lib/table-sort';
import type { DashboardData } from '@/types/domain';

const { Text, Title } = Typography;
const ReactECharts = dynamic(() => import('echarts-for-react'), {
  ssr: false,
  loading: () => <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin /></div>,
});

function sourceLabel(value: string) {
  const map: Record<string, string> = {
    offline_payment: '线下缴费',
    'offline-training': '线下课程',
    online_course_order: '线上课程',
    online_course: '线上课程',
    lizhi: '荔枝微课',
    finance_order: '财务订单',
    orders: '统一订单',
    'commerce-sale': '电商销售',
  };
  return map[value] || value || '未知来源';
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    platformAdapter.getDashboardData()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const chartOption = useMemo(() => ({
    tooltip: { trigger: 'axis' },
    grid: { left: 36, right: 18, top: 28, bottom: 28 },
    xAxis: { type: 'category', data: ['学员', '订单', '收入', '商品', '低库存'] },
    yAxis: { type: 'value' },
    series: [{
      type: 'bar',
      data: [
        data?.totalMembers || 0,
        data?.totalOrders || 0,
        Math.round((data?.totalRevenue || 0) / 100),
        data?.productCount || 0,
        data?.lowStockCount || 0,
      ],
      itemStyle: {
        borderRadius: [8, 8, 0, 0],
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [{ offset: 0, color: '#F72A8A' }, { offset: 1, color: '#7C3AED' }],
        },
      },
    }],
  }), [data]);

  if (loading) return <div style={{ padding: 80, textAlign: 'center' }}><Spin size="large" /></div>;

  return (
    <div>
      <div className="page-header">
        <Title level={2}>首页总览</Title>
        <Text type="secondary">统一读取学员、订单、电商库存与财务核心数据。</Text>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8} xl={4}><Card><Statistic title="学员总数" value={data?.totalMembers || 0} prefix={<UserOutlined />} /></Card></Col>
        <Col xs={24} md={8} xl={4}><Card><Statistic title="活跃学员" value={data?.activeMembers || 0} prefix={<TeamOutlined />} valueStyle={{ color: '#22C55E' }} /></Card></Col>
        <Col xs={24} md={8} xl={4}><Card><Statistic title="订单总数" value={data?.totalOrders || 0} prefix={<OrderedListOutlined />} /></Card></Col>
        <Col xs={24} md={8} xl={4}><Card><Statistic title="总成交额" value={formatCompactMoney(data?.totalRevenue || 0)} valueStyle={{ color: '#F72A8A' }} /></Card></Col>
        <Col xs={24} md={8} xl={4}><Card><Statistic title="本月收入" value={formatCompactMoney(data?.monthRevenue || 0)} valueStyle={{ color: '#7C3AED' }} /></Card></Col>
        <Col xs={24} md={8} xl={4}><Card><Statistic title="商品总数" value={data?.productCount || 0} prefix={<ShopOutlined />} /></Card></Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card title={<Space><BarChartOutlined />运营数据概览</Space>}>
            <ReactECharts option={chartOption} style={{ height: 300 }} />
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card title="订单来源占比">
            {data?.orderSources?.length ? (
              <List
                dataSource={data.orderSources}
                renderItem={item => (
                  <List.Item>
                    <Text>{sourceLabel(item.label)}</Text>
                    <Space>
                      <Tag color="purple">{item.count} 单</Tag>
                      <Text strong>{formatPaymentAmount(item.value)}</Text>
                    </Space>
                  </List.Item>
                )}
              />
            ) : <Empty description="暂无订单来源数据" />}
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card title="最近学员">
            <List
              dataSource={data?.recentMembers || []}
              locale={{ emptyText: <Empty description="暂无学员数据" /> }}
              renderItem={member => (
                <List.Item>
                  <Space>
                    <Avatar style={{ background: 'linear-gradient(135deg,#F72A8A,#7C3AED)' }}>{member.name[0]}</Avatar>
                    <div>
                      <Text strong>{member.name}</Text>
                      <div><Text type="secondary">{member.phone || '-'}</Text></div>
                    </div>
                  </Space>
                  <Tag color="magenta">{member.level}</Tag>
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card title={<Space><DollarOutlined />最近订单</Space>}>
            <Table
              scroll={{ x: 'max-content' }}
              size="small"
              rowKey="id"
              dataSource={data?.recentOrders || []}
              pagination={false}
              columns={sortableColumns<any>([
                { title: '订单', dataIndex: 'orderNo', ellipsis: true },
                { title: '学员', dataIndex: 'memberName' },
                { title: '金额', dataIndex: 'amount', render: value => formatPaymentAmount(value), align: 'right' as const },
              ])}
              locale={{ emptyText: <Empty description="暂无订单数据" /> }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
