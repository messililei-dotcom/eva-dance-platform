'use client';
import { useEffect, useMemo, useState } from 'react';
import { Card, Col, Empty, Progress, Row, Spin, Statistic, Table, Tag, Typography } from 'antd';
import { DollarOutlined, FundOutlined, RiseOutlined, WalletOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { platformAdapter } from '@/lib/adapters/platform';
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    platformAdapter.getFinanceSummary()
      .then(setSummary)
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
        <Text type="secondary">先以统一订单为收入账本，后续接入独立财务流水、支出和结算。</Text>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={6}><Card><Statistic title="收入合计" value={summary?.income || 0} prefix="¥" valueStyle={{ color: '#22C55E' }} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="退款/冲减" value={summary?.expense || 0} prefix="¥" valueStyle={{ color: '#EF4444' }} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="净收入" value={summary?.profit || 0} prefix={<WalletOutlined />} valueStyle={{ color: '#F72A8A' }} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="客单价" value={summary?.averageOrderAmount || 0} prefix="¥" /></Card></Col>
      </Row>

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
        <Col span={24}>
          <Card title={<><DollarOutlined /> 最近财务订单</>} bodyStyle={{ padding: 0 }}>
            <Table
              rowKey="id"
              size="middle"
              dataSource={summary?.recentOrders || []}
              pagination={false}
              locale={{ emptyText: <Empty description="暂无财务订单" /> }}
              columns={[
                { title: '订单号', dataIndex: 'orderNo' },
                { title: '会员', dataIndex: 'memberName' },
                { title: '类型', dataIndex: 'orderType', render: value => <Tag color="magenta">{typeLabel(value)}</Tag> },
                { title: '金额', dataIndex: 'amount', align: 'right' as const, render: value => <Text strong style={{ color: '#F72A8A' }}>{money(value)}</Text> },
                { title: '日期', dataIndex: 'orderDate' },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
