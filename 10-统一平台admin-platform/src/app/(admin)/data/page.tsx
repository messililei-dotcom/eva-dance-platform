'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Card, Col, Empty, Progress, Row, Space, Spin, Statistic, Tabs, Tag, Typography } from 'antd';
import { Table } from '@/components/adaptive-table';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  BookOutlined,
  CheckCircleOutlined,
  DollarOutlined,
  FormOutlined,
  RiseOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  SmileOutlined,
  StarFilled,
  TeamOutlined,
  TrophyOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import { platformAdapter } from '@/lib/adapters/platform';
import { formatCompactMoney, formatPaymentAmount } from '@/lib/money-format';
import { sortableColumns } from '@/lib/table-sort';
import type { DataAnalytics } from '@/types/domain';

const { Text, Title } = Typography;

function money(value: number) {
  return formatPaymentAmount(value);
}

function typeLabel(value: string) {
  const map: Record<string, string> = {
    online_course: '线上课程',
    course: '线上课程',
    lizhi: '荔枝微课',
    'offline-training': '线下课程',
    training: '线下培训',
    shop: '电商商品',
    finance: '财务订单',
    membership: '会员服务',
    offline_payment: '线下缴费',
    online_course_order: '线上课程',
    finance_order: '财务订单',
    orders: '统一订单',
  };
  return map[value] || value || '其他收入';
}

function BarChart({ data }: { data: { month: string; revenue: number }[] }) {
  const values = data.map(item => item.revenue);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const currentIndex = data.length - 1;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', height: 240, padding: '0 8px' }}>
      {data.map((item, index) => {
        const height = Math.round(56 + ((item.revenue - min) / Math.max(max - min, 1)) * 124);
        const isCurrent = index === currentIndex;
        return (
          <div key={`${item.month}-${index}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, maxWidth: 54 }}>
            <span style={{ fontSize: 11, color: '#6b7280', marginBottom: 4, fontWeight: 500 }}>
              {formatCompactMoney(item.revenue)}
            </span>
            <div
              style={{
                width: 32,
                height,
                borderRadius: '6px 6px 0 0',
                background: isCurrent
                  ? 'linear-gradient(180deg, #F72A8A 0%, #7C3AED 100%)'
                  : 'linear-gradient(180deg, #93C5FD 0%, #DBEAFE 100%)',
                transition: 'height 0.3s',
              }}
              title={`${item.month}: ${money(item.revenue)}`}
            />
            <span style={{ fontSize: 12, color: '#374151', marginTop: 8, fontWeight: isCurrent ? 700 : 400 }}>
              {item.month}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function PurpleProgress({ percent }: { percent: number }) {
  return (
    <Progress
      percent={percent}
      size="small"
      strokeColor={{ '0%': '#F72A8A', '100%': '#7C3AED' }}
      trailColor="#f3e8ff"
      format={() => `${percent}%`}
    />
  );
}

function RatioTags({ data }: { data: DataAnalytics['finance']['byType'] }) {
  if (!data.length) return <Empty description="暂无收入构成数据" />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {data.map(item => (
        <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: item.color, flexShrink: 0 }} />
          <span style={{ width: 84, fontSize: 13, color: '#374151', flexShrink: 0 }}>{typeLabel(item.category)}</span>
          <div style={{ flex: 1, height: 18, borderRadius: 9, background: '#f3f4f6', overflow: 'hidden' }}>
            <div
              style={{
                width: `${item.percent}%`,
                height: '100%',
                borderRadius: 9,
                background: item.color,
                minWidth: item.percent > 0 ? 4 : 0,
              }}
            />
          </div>
          <span style={{ width: 76, fontSize: 12, color: '#6b7280', textAlign: 'right', flexShrink: 0 }}>
            {money(item.amount)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function DataPage() {
  const [data, setData] = useState<DataAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    platformAdapter.getAnalyticsData()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const tabs = useMemo(() => {
    if (!data) return [];

    return [
      {
        key: 'sales',
        label: '销售趋势',
        children: (
          <>
            <Row gutter={[16, 16]}>
              <Col xs={24} md={6}><Card><Statistic title="本月收入" value={formatCompactMoney(data.sales.monthIncome)} prefix={<DollarOutlined />} valueStyle={{ color: '#F72A8A', fontWeight: 700 }} /></Card></Col>
              <Col xs={24} md={6}><Card><Statistic title="环比增长" value={data.sales.growthRate} precision={1} prefix={data.sales.growthRate >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />} suffix="%" valueStyle={{ color: data.sales.growthRate >= 0 ? '#22C55E' : '#EF4444', fontWeight: 700 }} /></Card></Col>
              <Col xs={24} md={6}><Card><Statistic title="订单数" value={data.sales.orderCount} prefix={<ShoppingCartOutlined />} valueStyle={{ color: '#3B82F6', fontWeight: 700 }} /></Card></Col>
              <Col xs={24} md={6}><Card><Statistic title="客单价" value={data.sales.averageOrderAmount} formatter={value => money(Number(value))} prefix={<RiseOutlined />} valueStyle={{ color: '#F59E0B', fontWeight: 700 }} /></Card></Col>
            </Row>

            <Card title="月度收入趋势" style={{ marginTop: 16 }}>
              <BarChart data={data.sales.monthly} />
              <Space style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
                <Tag color="magenta">当前月</Tag>
                <Tag color="blue">历史月份</Tag>
              </Space>
            </Card>
          </>
        ),
      },
      {
        key: 'members',
        label: '学员增长',
        children: (
          <>
            <Row gutter={[16, 16]}>
              <Col xs={24} md={6}><Card><Statistic title="总学员" value={data.members.total} prefix={<TeamOutlined />} valueStyle={{ color: '#F72A8A', fontWeight: 700 }} /></Card></Col>
              <Col xs={24} md={6}><Card><Statistic title="本月新增" value={data.members.newThisMonth} prefix={<UserAddOutlined />} valueStyle={{ color: '#22C55E', fontWeight: 700 }} /></Card></Col>
              <Col xs={24} md={6}><Card><Statistic title="活跃学员" value={data.members.active} prefix={<SmileOutlined />} valueStyle={{ color: '#3B82F6', fontWeight: 700 }} /></Card></Col>
              <Col xs={24} md={6}><Card><Statistic title="流失观察" value={data.members.churnRate} precision={1} prefix={<ArrowDownOutlined />} suffix="%" valueStyle={{ color: '#EF4444', fontWeight: 700 }} /></Card></Col>
            </Row>

            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
              <Col xs={24} xl={12}>
                <Card title="学员等级分布">
                  <Table
                    scroll={{ x: 'max-content' }}
                    rowKey="key"
                    dataSource={data.members.byLevel}
                    pagination={false}
                    size="small"
                    locale={{ emptyText: <Empty description="暂无等级数据" /> }}
                    columns={sortableColumns<any>([
                      { title: '等级名称', dataIndex: 'level' },
                      { title: '人数', dataIndex: 'count', width: 90, render: value => <Text strong style={{ color: '#F72A8A' }}>{value}</Text> },
                      { title: '占比', dataIndex: 'percent', width: 190, render: value => <PurpleProgress percent={value} /> },
                    ])}
                  />
                </Card>
              </Col>
              <Col xs={24} xl={12}>
                <Card title="城市分布">
                  <Table
                    scroll={{ x: 'max-content' }}
                    rowKey="key"
                    dataSource={data.members.byCity}
                    pagination={false}
                    size="small"
                    locale={{ emptyText: <Empty description="暂无城市数据" /> }}
                    columns={sortableColumns<any>([
                      { title: '城市', dataIndex: 'city' },
                      { title: '人数', dataIndex: 'count', width: 90, render: value => <Text strong style={{ color: '#3B82F6' }}>{value}</Text> },
                      { title: '占比', dataIndex: 'percent', width: 190, render: value => <PurpleProgress percent={value} /> },
                    ])}
                  />
                </Card>
              </Col>
            </Row>
          </>
        ),
      },
      {
        key: 'courses',
        label: '课程分析',
        children: (
          <>
            <Row gutter={[16, 16]}>
              <Col xs={24} md={6}><Card><Statistic title="在线课程" value={data.courses.onlineCount} prefix={<BookOutlined />} valueStyle={{ color: '#F72A8A', fontWeight: 700 }} /></Card></Col>
              <Col xs={24} md={6}><Card><Statistic title="线下课程" value={data.courses.offlineCount} prefix={<ShopOutlined />} valueStyle={{ color: '#3B82F6', fontWeight: 700 }} /></Card></Col>
              <Col xs={24} md={6}><Card><Statistic title="总报名人次" value={data.courses.totalEnrollments} prefix={<FormOutlined />} valueStyle={{ color: '#22C55E', fontWeight: 700 }} /></Card></Col>
              <Col xs={24} md={6}><Card><Statistic title="容量使用率" value={data.courses.completionRate} suffix="%" prefix={<CheckCircleOutlined />} valueStyle={{ color: '#F59E0B', fontWeight: 700 }} /></Card></Col>
            </Row>

            <Card title="热门课程排行 TOP 10" style={{ marginTop: 16 }}>
              <Table
                scroll={{ x: 'max-content' }}
                rowKey="key"
                dataSource={data.courses.hotCourses}
                pagination={false}
                locale={{ emptyText: <Empty description="暂无课程数据" /> }}
                columns={sortableColumns<any>([
                  {
                    title: '排名',
                    dataIndex: 'rank',
                    width: 70,
                    render: value => value <= 3 ? <TrophyOutlined style={{ color: value === 1 ? '#F59E0B' : value === 2 ? '#9CA3AF' : '#D97706', fontSize: 18 }} /> : <Text strong>{value}</Text>,
                  },
                  { title: '课程名称', dataIndex: 'name', ellipsis: true, className: 'course-name-column' },
                  { title: '类型', dataIndex: 'type', width: 90, render: value => <Tag color={value === '线上' ? 'purple' : 'blue'}>{value}</Tag> },
                  { title: '报名数', dataIndex: 'enrollments', width: 110, render: value => <Text strong style={{ color: '#3B82F6' }}>{value}</Text> },
                  { title: '容量使用率', dataIndex: 'completion', width: 180, render: value => <Progress percent={value} size="small" strokeColor={{ '0%': '#F72A8A', '100%': '#22C55E' }} /> },
                  { title: '评分', dataIndex: 'rating', width: 90, render: value => value ? <Space size={4}><StarFilled style={{ color: '#F59E0B' }} /><Text strong>{value}</Text></Space> : <Text type="secondary">-</Text> },
                ])}
              />
            </Card>
          </>
        ),
      },
      {
        key: 'finance',
        label: '财务概览',
        children: (
          <>
            <Row gutter={[16, 16]}>
              <Col xs={24} md={6}><Card><Statistic title="总收入" value={formatCompactMoney(data.finance.income)} prefix={<DollarOutlined />} valueStyle={{ color: '#F72A8A', fontWeight: 700 }} /></Card></Col>
              <Col xs={24} md={6}><Card><Statistic title="退款/支出" value={formatCompactMoney(data.finance.expense)} prefix={<ArrowDownOutlined />} valueStyle={{ color: '#EF4444', fontWeight: 700 }} /></Card></Col>
              <Col xs={24} md={6}><Card><Statistic title="净收入" value={formatCompactMoney(data.finance.profit)} prefix={<RiseOutlined />} valueStyle={{ color: '#22C55E', fontWeight: 700 }} /></Card></Col>
              <Col xs={24} md={6}><Card><Statistic title="净收入率" value={data.finance.profitRate} precision={1} suffix="%" prefix={<TrophyOutlined />} valueStyle={{ color: '#3B82F6', fontWeight: 700 }} /></Card></Col>
            </Row>

            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
              <Col xs={24} xl={12}>
                <Card title="收入构成明细">
                  <Table
                    scroll={{ x: 'max-content' }}
                    rowKey="key"
                    dataSource={data.finance.byType}
                    pagination={false}
                    size="small"
                    locale={{ emptyText: <Empty description="暂无收入构成数据" /> }}
                    columns={sortableColumns<any>([
                      { title: '类别', dataIndex: 'category', render: (value, record) => <Space><span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: record.color }} /><span>{typeLabel(value)}</span></Space> },
                      { title: '金额', dataIndex: 'amount', width: 130, render: value => <Text strong style={{ color: '#F72A8A' }}>{money(value)}</Text> },
                      { title: '占比', dataIndex: 'percent', width: 100, render: value => <Tag color="purple">{value}%</Tag> },
                    ])}
                  />
                </Card>
              </Col>
              <Col xs={24} xl={12}>
                <Card title="收入占比分布">
                  <RatioTags data={data.finance.byType} />
                </Card>
              </Col>
            </Row>
          </>
        ),
      },
    ];
  }, [data]);

  if (loading) return <div style={{ padding: 80, textAlign: 'center' }}><Spin size="large" /></div>;

  return (
    <div>
      <div className="page-header">
        <Title level={2}>数据分析</Title>
        <Text type="secondary">统一读取学员、课程、订单、电商和财务数据，所有统计口径来自最终运营平台适配层。</Text>
      </div>

      {data ? <Tabs defaultActiveKey="sales" size="large" items={tabs} /> : <Card><Empty description="暂无可用数据，请确认统一后台 API 与数据库连接正常" /></Card>}
    </div>
  );
}
