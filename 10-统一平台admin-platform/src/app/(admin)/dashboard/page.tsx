'use client';
import { useEffect, useMemo, useState } from 'react';
import { Avatar, Card, Col, Empty, List, Row, Space, Spin, Statistic, Table, Tag, Typography } from 'antd';
import {
  BarChartOutlined, DollarOutlined, OrderedListOutlined, ShopOutlined,
  TeamOutlined, UserOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { platformAdapter } from '@/lib/adapters/platform';
import { platformLinks } from '@/lib/platform-links';
import type { DashboardData } from '@/types/domain';

const { Text, Title } = Typography;

function money(value: number) {
  return `¥${Number(value || 0).toLocaleString()}`;
}

function sourceLabel(value: string) {
  const map: Record<string, string> = {
    offline_payment: '线下缴费',
    online_course_order: '网课订单',
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
    xAxis: { type: 'category', data: ['会员', '订单', '收入', '商品', '低库存'] },
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
        <Text type="secondary">统一读取会员、订单、电商库存与财务核心数据。</Text>
      </div>

      <div style={{
        background: 'linear-gradient(135deg, #FFF1F8 0%, #F6E9FF 48%, #EEF5FF 100%)',
        border: '1px solid #F4D8EA',
        borderRadius: 16,
        padding: 24,
        marginBottom: 16,
      }}>
        <Row align="middle" gutter={[16, 16]}>
          <Col flex="auto">
            <Title level={3} style={{ margin: 0, color: '#4A164B' }}>伊娃东方舞统一数字化运营平台</Title>
            <Text style={{ color: '#7A3B72' }}>会员、课程、订单、电商、财务正在向一个后台收敛。</Text>
          </Col>
          <Col>
            <Tag color="magenta">{platformLinks.admin.domain}</Tag>
          </Col>
        </Row>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8} xl={4}><Card><Statistic title="会员总数" value={data?.totalMembers || 0} prefix={<UserOutlined />} /></Card></Col>
        <Col xs={24} md={8} xl={4}><Card><Statistic title="活跃会员" value={data?.activeMembers || 0} prefix={<TeamOutlined />} valueStyle={{ color: '#22C55E' }} /></Card></Col>
        <Col xs={24} md={8} xl={4}><Card><Statistic title="订单总数" value={data?.totalOrders || 0} prefix={<OrderedListOutlined />} /></Card></Col>
        <Col xs={24} md={8} xl={4}><Card><Statistic title="总成交额" value={data?.totalRevenue || 0} prefix="¥" valueStyle={{ color: '#F72A8A' }} /></Card></Col>
        <Col xs={24} md={8} xl={4}><Card><Statistic title="本月收入" value={data?.monthRevenue || 0} prefix="¥" valueStyle={{ color: '#7C3AED' }} /></Card></Col>
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
                      <Text strong>{money(item.value)}</Text>
                    </Space>
                  </List.Item>
                )}
              />
            ) : <Empty description="暂无订单来源数据" />}
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card title="最近会员">
            <List
              dataSource={data?.recentMembers || []}
              locale={{ emptyText: <Empty description="暂无会员数据" /> }}
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
              size="small"
              rowKey="id"
              dataSource={data?.recentOrders || []}
              pagination={false}
              columns={[
                { title: '订单', dataIndex: 'orderNo', ellipsis: true },
                { title: '会员', dataIndex: 'memberName' },
                { title: '金额', dataIndex: 'amount', render: money, align: 'right' as const },
              ]}
              locale={{ emptyText: <Empty description="暂无订单数据" /> }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
