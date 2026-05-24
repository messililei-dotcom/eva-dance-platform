'use client';
import React from 'react';
import { Card, Row, Col, Statistic, Tabs, Table, Tag, Progress, Space } from 'antd';
import {
  DollarOutlined,
  RiseOutlined,
  ShoppingCartOutlined,
  UserOutlined,
  TeamOutlined,
  UserAddOutlined,
  SmileOutlined,
  WarningOutlined,
  BookOutlined,
  ShopOutlined,
  FormOutlined,
  CheckCircleOutlined,
  TrophyOutlined,
  StarFilled,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons';


// ======================== Mock 数据 ========================

// --- Tab 1: 销售趋势 ---
const salesMonthlyData = [
  { month: '1月', revenue: 18000 },
  { month: '2月', revenue: 21000 },
  { month: '3月', revenue: 25000 },
  { month: '4月', revenue: 32000 },
  { month: '5月', revenue: 48260 },
  { month: '6月', revenue: 38000 },
  { month: '7月', revenue: 42000 },
  { month: '8月', revenue: 45000 },
  { month: '9月', revenue: 40000 },
  { month: '10月', revenue: 35000 },
  { month: '11月', revenue: 30000 },
  { month: '12月', revenue: 48000 },
];

// Normalize heights: min revenue → 90px, max revenue → 180px
const revValues = salesMonthlyData.map(d => d.revenue);
const revMin = Math.min(...revValues);
const revMax = Math.max(...revValues);
const barHeight = (v: number) => Math.round(90 + ((v - revMin) / (revMax - revMin)) * 90);

// --- Tab 2: 学员增长 ---
const memberLevelData = [
  { key: '1', level: 'VIP 黑金会员', count: 48, percent: 17.7 },
  { key: '2', level: 'VIP 白金会员', count: 82, percent: 30.3 },
  { key: '3', level: '普通会员', count: 93, percent: 34.3 },
  { key: '4', level: '体验学员', count: 48, percent: 17.7 },
];

const cityDistribution = [
  { key: '1', city: '石家庄', count: 86, percent: 31.7 },
  { key: '2', city: '保定', count: 42, percent: 15.5 },
  { key: '3', city: '唐山', count: 35, percent: 12.9 },
  { key: '4', city: '邯郸', count: 28, percent: 10.3 },
  { key: '5', city: '沧州', count: 22, percent: 8.1 },
  { key: '6', city: '邢台', count: 18, percent: 6.6 },
  { key: '7', city: '廊坊', count: 15, percent: 5.5 },
  { key: '8', city: '其他城市', count: 25, percent: 9.2 },
];

// --- Tab 3: 课程分析 ---
const hotCourses = [
  { key: '1', rank: 1, name: '东方舞基础入门', type: '线上', enrollments: 58, completion: 72, rating: 4.9 },
  { key: '2', rank: 2, name: '肚皮舞进阶技巧', type: '线上', enrollments: 47, completion: 65, rating: 4.8 },
  { key: '3', rank: 3, name: '成品舞《Majnun》', type: '线上', enrollments: 39, completion: 58, rating: 4.7 },
  { key: '4', rank: 4, name: '周末集训班', type: '线下', enrollments: 35, completion: 88, rating: 4.9 },
  { key: '5', rank: 5, name: '私教一对一', type: '线下', enrollments: 32, completion: 95, rating: 5.0 },
  { key: '6', rank: 6, name: '成品舞《Baladi》', type: '线上', enrollments: 28, completion: 60, rating: 4.6 },
  { key: '7', rank: 7, name: '舞感训练营', type: '线下', enrollments: 25, completion: 82, rating: 4.7 },
  { key: '8', rank: 8, name: '成品舞《Oritentsai》', type: '线上', enrollments: 22, completion: 55, rating: 4.5 },
  { key: '9', rank: 9, name: '少儿东方舞启蒙', type: '线下', enrollments: 20, completion: 78, rating: 4.8 },
  { key: '10', rank: 10, name: '年会节目编排', type: '线下', enrollments: 18, completion: 90, rating: 4.6 },
];

// --- Tab 4: 财务概览 ---
const revenueBreakdown = [
  { key: '1', category: '线上课程', amount: 52300, percent: 22.9, color: '#a855f7' },
  { key: '2', category: '线下培训', amount: 68400, percent: 29.9, color: '#3b82f6' },
  { key: '3', category: '私教课程', amount: 45200, percent: 19.8, color: '#10b981' },
  { key: '4', category: '年卡会员', amount: 35800, percent: 15.7, color: '#f59e0b' },
  { key: '5', category: '演出活动', amount: 18300, percent: 8.0, color: '#ec4899' },
  { key: '6', category: '其他收入', amount: 8600, percent: 3.8, color: '#6b7280' },
];

// ======================== 组件 ========================

/** 纯 CSS 柱状图 */
function BarChart({ data }: { data: { month: string; revenue: number }[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', height: 240, padding: '0 8px' }}>
      {data.map((d, i) => {
        const h = barHeight(d.revenue);
        const isCurrent = d.month === '5月';
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, maxWidth: 50 }}>
            {/* 金额标签 */}
            <span style={{ fontSize: 11, color: '#6b7280', marginBottom: 4, fontWeight: 500 }}>
              ¥{(d.revenue / 1000).toFixed(1)}k
            </span>
            {/* 柱子 */}
            <div
              style={{
                width: 32,
                height: h,
                borderRadius: '6px 6px 0 0',
                background: isCurrent
                  ? 'linear-gradient(180deg, #a855f7 0%, #c084fc 100%)'
                  : 'linear-gradient(180deg, #c084fc 0%, #e9d5ff 100%)',
                transition: 'height 0.3s',
                position: 'relative',
                cursor: 'pointer',
              }}
              title={`${d.month}: ¥${d.revenue.toLocaleString()}`}
            />
            {/* 底部连线（模拟折线） */}
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: isCurrent ? '#a855f7' : '#c084fc',
                border: '2px solid #fff',
                boxShadow: '0 0 0 1px #a855f7',
                marginTop: -4,
                zIndex: 1,
              }}
            />
            {/* 月份 */}
            <span style={{ fontSize: 12, color: '#374151', marginTop: 6, fontWeight: isCurrent ? 700 : 400 }}>
              {d.month}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** 自定义进度条（紫色系） */
function PurpleProgress({ percent }: { percent: number }) {
  return (
    <Progress
      percent={percent}
      size="small"
      strokeColor={{
        '0%': '#a855f7',
        '100%': '#c084fc',
      }}
      trailColor="#f3e8ff"
      format={() => `${percent}%`}
    />
  );
}

/** 彩色占比 Tag 列表（替代饼图） */
function RatioTags({ data }: { data: { color: string; category: string; percent: number; amount: number }[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {data.map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* 色块 */}
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 3,
              backgroundColor: item.color,
              flexShrink: 0,
            }}
          />
          {/* 类别名 */}
          <span style={{ width: 72, fontSize: 13, color: '#374151', flexShrink: 0 }}>{item.category}</span>
          {/* 占比条 */}
          <div style={{ flex: 1, height: 18, borderRadius: 9, background: '#f3f4f6', overflow: 'hidden' }}>
            <div
              style={{
                width: `${item.percent}%`,
                height: '100%',
                borderRadius: 9,
                background: item.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                paddingRight: 6,
                minWidth: item.percent > 8 ? 36 : 0,
              }}
            >
              {item.percent > 8 && (
                <span style={{ fontSize: 11, color: '#fff', fontWeight: 600, lineHeight: 1 }}>{item.percent}%</span>
              )}
            </div>
          </div>
          {/* 金额 */}
          <span style={{ width: 64, fontSize: 12, color: '#6b7280', textAlign: 'right', flexShrink: 0 }}>
            ¥{item.amount.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

// ======================== 主页面 ========================

export default function DataPage() {
  return (
    <>
      <h2 style={{ marginBottom: 20, color: '#1f2937' }}>数据分析</h2>

      {/* ---------- Tab 1: 销售趋势 ---------- */}
      <Tabs defaultActiveKey="sales" size="large" tabBarStyle={{ marginBottom: 16 }} items={[
        { key: "sales", label: "销售趋势", children: <>
          {/* 统计卡片 */}
          <Row gutter={[16, 16]}>
            <Col span={6}>
              <Card hoverable>
                <Statistic
                  title="本月收入"
                  value={48260}
                  precision={0}
                  prefix={<DollarOutlined />}
                  suffix="¥"
                  valueStyle={{ color: '#a855f7', fontWeight: 700 }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card hoverable>
                <Statistic
                  title="环比增长"
                  value={12.5}
                  precision={1}
                  prefix={<ArrowUpOutlined />}
                  suffix="%"
                  valueStyle={{ color: '#10b981', fontWeight: 700 }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card hoverable>
                <Statistic
                  title="订单数"
                  value={136}
                  prefix={<ShoppingCartOutlined />}
                  valueStyle={{ color: '#3b82f6', fontWeight: 700 }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card hoverable>
                <Statistic
                  title="客单价"
                  value={355}
                  precision={0}
                  prefix={<RiseOutlined />}
                  suffix="¥"
                  valueStyle={{ color: '#f59e0b', fontWeight: 700 }}
                />
              </Card>
            </Col>
          </Row>

          {/* 柱状图 */}
          <Card title="月度收入趋势" style={{ marginTop: 16 }}>
            <BarChart data={salesMonthlyData} />
            <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 12 }}>
              <Space>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: 'linear-gradient(180deg, #a855f7 0%, #c084fc 100%)' }} />
                <span style={{ fontSize: 12, color: '#6b7280' }}>当月</span>
              </Space>
              <Space>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: 'linear-gradient(180deg, #c084fc 0%, #e9d5ff 100%)' }} />
                <span style={{ fontSize: 12, color: '#6b7280' }}>其他月份</span>
              </Space>
            </div>
          </Card>
        </> },
        { key: "members", label: "学员增长", children: <>
          {/* 统计卡片 */}
          <Row gutter={[16, 16]}>
            <Col span={6}>
              <Card hoverable>
                <Statistic
                  title="总学员"
                  value={271}
                  prefix={<TeamOutlined />}
                  valueStyle={{ color: '#a855f7', fontWeight: 700 }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card hoverable>
                <Statistic
                  title="本月新增"
                  value={24}
                  prefix={<UserAddOutlined />}
                  valueStyle={{ color: '#10b981', fontWeight: 700 }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card hoverable>
                <Statistic
                  title="活跃学员"
                  value={198}
                  prefix={<SmileOutlined />}
                  valueStyle={{ color: '#3b82f6', fontWeight: 700 }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card hoverable>
                <Statistic
                  title="流失率"
                  value={3.2}
                  precision={1}
                  prefix={<ArrowDownOutlined />}
                  suffix="%"
                  valueStyle={{ color: '#ef4444', fontWeight: 700 }}
                />
              </Card>
            </Col>
          </Row>

          {/* 等级分布 + 城市分布 */}
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col span={12}>
              <Card title="会员等级分布">
                <Table
                  dataSource={memberLevelData}
                  pagination={false}
                  size="small"
                  columns={[
                    { title: '等级名称', dataIndex: 'level', key: 'level' },
                    {
                      title: '人数',
                      dataIndex: 'count',
                      key: 'count',
                      width: 80,
                      render: (v: number) => <span style={{ fontWeight: 600, color: '#a855f7' }}>{v}</span>,
                    },
                    {
                      title: '占比',
                      dataIndex: 'percent',
                      key: 'percent',
                      width: 180,
                      render: (v: number) => <PurpleProgress percent={v} />,
                    },
                  ]}
                />
              </Card>
            </Col>
            <Col span={12}>
              <Card title="城市分布">
                <Table
                  dataSource={cityDistribution}
                  pagination={false}
                  size="small"
                  columns={[
                    { title: '城市', dataIndex: 'city', key: 'city' },
                    {
                      title: '人数',
                      dataIndex: 'count',
                      key: 'count',
                      width: 80,
                      render: (v: number) => <span style={{ fontWeight: 600, color: '#3b82f6' }}>{v}</span>,
                    },
                    {
                      title: '占比',
                      dataIndex: 'percent',
                      key: 'percent',
                      width: 180,
                      render: (v: number) => <PurpleProgress percent={v} />,
                    },
                  ]}
                />
              </Card>
            </Col>
          </Row>
        </> },
        { key: "courses", label: "课程分析", children: <>
          {/* 统计卡片 */}
          <Row gutter={[16, 16]}>
            <Col span={6}>
              <Card hoverable>
                <Statistic
                  title="在线课程"
                  value={15}
                  prefix={<BookOutlined />}
                  valueStyle={{ color: '#a855f7', fontWeight: 700 }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card hoverable>
                <Statistic
                  title="线下课程"
                  value={13}
                  prefix={<ShopOutlined />}
                  valueStyle={{ color: '#3b82f6', fontWeight: 700 }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card hoverable>
                <Statistic
                  title="总报名人次"
                  value={364}
                  prefix={<FormOutlined />}
                  valueStyle={{ color: '#10b981', fontWeight: 700 }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card hoverable>
                <Statistic
                  title="完课率"
                  value={68}
                  suffix="%"
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: '#f59e0b', fontWeight: 700 }}
                />
              </Card>
            </Col>
          </Row>

          {/* 热门课程排行 */}
          <Card title="🔥 热门课程排行 TOP 10" style={{ marginTop: 16 }}>
            <Table
              dataSource={hotCourses}
              pagination={false}
              columns={[
                {
                  title: '排名',
                  dataIndex: 'rank',
                  key: 'rank',
                  width: 64,
                  render: (v: number) => {
                    if (v === 1) return <TrophyOutlined style={{ color: '#f59e0b', fontSize: 18 }} />;
                    if (v === 2) return <TrophyOutlined style={{ color: '#9ca3af', fontSize: 17 }} />;
                    if (v === 3) return <TrophyOutlined style={{ color: '#d97706', fontSize: 16 }} />;
                    return <span style={{ color: '#6b7280', fontWeight: 600 }}>{v}</span>;
                  },
                },
                { title: '课程名称', dataIndex: 'name', key: 'name' },
                {
                  title: '类型',
                  dataIndex: 'type',
                  key: 'type',
                  width: 80,
                  render: (v: string) => (
                    <Tag color={v === '线上' ? 'purple' : 'blue'}>{v}</Tag>
                  ),
                },
                {
                  title: '报名数',
                  dataIndex: 'enrollments',
                  key: 'enrollments',
                  width: 100,
                  render: (v: number) => (
                    <span style={{ color: '#3b82f6', fontWeight: 700, fontSize: 15 }}>{v}</span>
                  ),
                },
                {
                  title: '完成率',
                  dataIndex: 'completion',
                  key: 'completion',
                  width: 180,
                  render: (v: number) => (
                    <Progress
                      percent={v}
                      size="small"
                      strokeColor={{
                        '0%': '#a855f7',
                        '100%': '#10b981',
                      }}
                      trailColor="#f3e8ff"
                    />
                  ),
                },
                {
                  title: '评分',
                  dataIndex: 'rating',
                  key: 'rating',
                  width: 80,
                  render: (v: number) => (
                    <Space size={4}>
                      <StarFilled style={{ color: '#f59e0b', fontSize: 13 }} />
                      <span style={{ fontWeight: 600, color: '#374151' }}>{v}</span>
                    </Space>
                  ),
                },
              ]}
            />
          </Card>
        </> },
        { key: "finance", label: "财务概览", children: <>
          {/* 统计卡片 */}
          <Row gutter={[16, 16]}>
            <Col span={6}>
              <Card hoverable>
                <Statistic
                  title="总收入"
                  value={228600}
                  precision={0}
                  prefix={<DollarOutlined />}
                  suffix="¥"
                  valueStyle={{ color: '#a855f7', fontWeight: 700 }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card hoverable>
                <Statistic
                  title="总支出"
                  value={56800}
                  precision={0}
                  prefix={<ArrowDownOutlined />}
                  suffix="¥"
                  valueStyle={{ color: '#ef4444', fontWeight: 700 }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card hoverable>
                <Statistic
                  title="净利润"
                  value={171800}
                  precision={0}
                  prefix={<RiseOutlined />}
                  suffix="¥"
                  valueStyle={{ color: '#10b981', fontWeight: 700 }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card hoverable>
                <Statistic
                  title="利润率"
                  value={75.2}
                  precision={1}
                  suffix="%"
                  prefix={<TrophyOutlined />}
                  valueStyle={{ color: '#3b82f6', fontWeight: 700 }}
                />
              </Card>
            </Col>
          </Row>

          {/* 收入构成 */}
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col span={12}>
              <Card title="收入构成明细">
                <Table
                  dataSource={revenueBreakdown}
                  pagination={false}
                  size="small"
                  columns={[
                    {
                      title: '类别',
                      dataIndex: 'category',
                      key: 'category',
                      render: (v: string, r: any) => (
                        <Space>
                          <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: r.color }} />
                          <span>{v}</span>
                        </Space>
                      ),
                    },
                    {
                      title: '金额',
                      dataIndex: 'amount',
                      key: 'amount',
                      width: 120,
                      render: (v: number) => (
                        <span style={{ fontWeight: 600, color: '#a855f7' }}>¥{v.toLocaleString()}</span>
                      ),
                    },
                    {
                      title: '占比',
                      dataIndex: 'percent',
                      key: 'percent',
                      width: 100,
                      render: (v: number) => <Tag color="purple">{v}%</Tag>,
                    },
                  ]}
                />
              </Card>
            </Col>
            <Col span={12}>
              <Card title="收入占比分布">
                <RatioTags
                  data={revenueBreakdown.map(r => ({
                    color: r.color,
                    category: r.category,
                    percent: r.percent,
                    amount: r.amount,
                  }))}
                />
                <div style={{ marginTop: 16, fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>
                  各品类收入占比（本年累计）
                </div>
              </Card>
            </Col>
          </Row>
        </> }
      ]} />
    </>
  );
}
