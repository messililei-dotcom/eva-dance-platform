'use client';
import { useEffect, useMemo, useState } from 'react';
import { Card, Col, Empty, Progress, Row, Spin, Statistic, Table, Tabs, Tag, Typography } from 'antd';
import { DollarOutlined, FundOutlined, RiseOutlined, WalletOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { platformAdapter } from '@/lib/adapters/platform';
import { eduApi } from '@/lib/api';
import type { FinanceSummary } from '@/types/domain';

const { Text, Title } = Typography;

function money(value: number) {
  return `¥${Number(value || 0).toLocaleString()}`;
}

function typeLabel(value: string) {
  const map: Record<string, string> = {
    course: '线上课程',
    training: '线下培训',
    shop: '电商',
    finance: '财务',
    membership: '会员',
  };
  return map[value] || value || '其他';
}

export default function FinancePage() {
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [legacySummary, setLegacySummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      platformAdapter.getFinanceSummary(),
      eduApi.getFinanceSummary().catch(() => null),
    ])
      .then(([nextSummary, financeData]) => {
        setSummary(nextSummary);
        setLegacySummary(financeData);
      })
      .finally(() => setLoading(false));
  }, []);

  const pieOption = useMemo(() => ({
    tooltip: { trigger: 'item' },
    legend: { bottom: 0 },
    series: [{
      type: 'pie',
      radius: ['48%', '70%'],
      data: (summary?.byType || []).map(item => ({ name: typeLabel(item.label), value: item.value })),
      color: ['#F72A8A', '#7C3AED', '#3B82F6', '#22C55E', '#F59E0B'],
    }],
  }), [summary]);

  if (loading) return <div style={{ padding: 80, textAlign: 'center' }}><Spin size="large" /></div>;

  return (
    <div>
      <div className="page-header">
        <Title level={2}>财务中心</Title>
        <Text type="secondary">统一订单账本叠加旧财务收入、支出、退款和最近流水，覆盖线下培训、网课、电商与财务订单。</Text>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={6}><Card><Statistic title="收入合计" value={summary?.income || 0} prefix="¥" valueStyle={{ color: '#22C55E' }} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="支出/退款" value={(legacySummary?.totalExpense || 0) + (summary?.refunds || 0)} prefix="¥" valueStyle={{ color: '#EF4444' }} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="净收入" value={summary?.profit || 0} prefix={<WalletOutlined />} valueStyle={{ color: '#F72A8A' }} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="客单价" value={summary?.averageOrderAmount || 0} prefix="¥" /></Card></Col>
      </Row>

      <Tabs
        items={[
          {
            key: 'overview',
            label: '财务总览',
            children: (
              <Row gutter={[16, 16]}>
                <Col xs={24} xl={10}>
                  <Card title={<><FundOutlined /> 收入构成</>}>
                    {summary?.byType?.length ? <ReactECharts option={pieOption} style={{ height: 300 }} /> : <Empty description="暂无收入构成" />}
                  </Card>
                </Col>
                <Col xs={24} xl={14}>
                  <Card title={<><RiseOutlined /> 业务收入排名</>}>
                    {(summary?.byType || []).length ? (summary?.byType || []).map(item => {
                      const percent = summary?.income ? Math.round(item.value / summary.income * 100) : 0;
                      return (
                        <div key={item.label} style={{ marginBottom: 16 }}>
                          <Row justify="space-between">
                            <Col><Text strong>{typeLabel(item.label)}</Text><Tag color="purple" style={{ marginLeft: 8 }}>{item.count} 单</Tag></Col>
                            <Col><Text strong>{money(item.value)}</Text></Col>
                          </Row>
                          <Progress percent={percent} strokeColor={{ '0%': '#F72A8A', '100%': '#7C3AED' }} />
                        </div>
                      );
                    }) : <Empty description="暂无收入排名" />}
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: 'orders',
            label: `收入订单 ${summary?.recentOrders?.length || 0}`,
            children: (
              <Card title={<><DollarOutlined /> 最近收入订单</>} bodyStyle={{ padding: 0 }}>
                <Table<any>
                  rowKey="id"
                  size="middle"
                  dataSource={summary?.recentOrders || []}
                  pagination={{ pageSize: 12 }}
                  locale={{ emptyText: <Empty description="暂无财务订单" /> }}
                  columns={[
                    { title: '订单号', dataIndex: 'orderNo' },
                    { title: '会员', dataIndex: 'memberName' },
                    { title: '类型', dataIndex: 'orderType', render: value => <Tag color="magenta">{typeLabel(value)}</Tag> },
                    { title: '支付方式', dataIndex: 'payMethod' },
                    { title: '状态', dataIndex: 'status', render: value => <Tag color={value === 'refunded' ? 'blue' : 'green'}>{value}</Tag> },
                    { title: '金额', dataIndex: 'amount', align: 'right' as const, render: value => <Text strong style={{ color: '#F72A8A' }}>{money(value)}</Text> },
                    { title: '日期', dataIndex: 'orderDate' },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: 'expenses',
            label: `支出流水 ${legacySummary?.expenseRecords?.length || 0}`,
            children: (
              <Card bodyStyle={{ padding: 0 }}>
                <Table<any>
                  rowKey={(record) => String(record.id)}
                  size="middle"
                  dataSource={legacySummary?.expenseRecords || []}
                  pagination={{ pageSize: 12 }}
                  locale={{ emptyText: <Empty description="暂无支出流水" /> }}
                  columns={[
                    { title: '支出ID', dataIndex: 'id', width: 90 },
                    { title: '分类', dataIndex: 'category', width: 140, render: value => <Tag color="orange">{value || '未分类'}</Tag> },
                    { title: '金额', dataIndex: 'amount', align: 'right' as const, width: 120, render: value => <Text strong style={{ color: '#EF4444' }}>{money(value)}</Text> },
                    { title: '日期', dataIndex: 'expenseDate', width: 130 },
                    { title: '备注', dataIndex: 'remark', ellipsis: true },
                  ]}
                />
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
}
