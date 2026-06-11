'use client';
import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Table, Tag, Tabs, Button, Modal, Form, Input, Select, DatePicker, InputNumber, Space, Empty } from 'antd';
import {
  DollarOutlined,
  ThunderboltOutlined,
  ClockCircleOutlined,
  HistoryOutlined,
  TeamOutlined,
  PlusOutlined,
  GiftOutlined,
  PercentageOutlined,
  FireOutlined,
} from '@ant-design/icons';
import { onlineCourseApi } from '@/lib/api';
import { isRecord, pickArray, type UnknownRecord } from '@/lib/data-shape';
import { formatPaymentAmount } from '@/lib/money-format';

function money(value: number) {
  return formatPaymentAmount(value);
}

// ====== 营销活动数据 ======
const campaignStats = [
  { title: '进行中活动', value: 3, icon: <ThunderboltOutlined />, color: '#10b981' },
  { title: '即将开始', value: 2, icon: <ClockCircleOutlined />, color: '#f59e0b' },
  { title: '已结束', value: 12, icon: <HistoryOutlined />, color: '#6b7280' },
  { title: '总参与人数', value: 2847, icon: <TeamOutlined />, color: '#a855f7' },
];

interface Campaign {
  key: string;
  name: string;
  type: string;
  startTime: string;
  endTime: string;
  participants: number;
  status: string;
}

const campaigns: Campaign[] = [
  { key: '1', name: '520表白特惠', type: '限时折扣', startTime: '2026-05-20', endTime: '2026-05-25', participants: 856, status: '进行中' },
  { key: '2', name: '六一亲子拼团', type: '拼团', startTime: '2026-05-22', endTime: '2026-06-05', participants: 432, status: '进行中' },
  { key: '3', name: '学员日满减', type: '满减', startTime: '2026-05-25', endTime: '2026-05-26', participants: 0, status: '未开始' },
  { key: '4', name: '夏季新课早鸟价', type: '早鸟特惠', startTime: '2026-06-01', endTime: '2026-06-15', participants: 0, status: '未开始' },
  { key: '5', name: '学员日专属', type: '学员日', startTime: '2026-05-15', endTime: '2026-05-15', participants: 523, status: '已结束' },
  { key: '6', name: '新人大礼包', type: '新人专享', startTime: '2026-05-01', endTime: '2026-05-31', participants: 634, status: '进行中' },
  { key: '7', name: '五一特惠周', type: '限时折扣', startTime: '2026-05-01', endTime: '2026-05-07', participants: 402, status: '已结束' },
  { key: '8', name: '母亲节感恩回馈', type: '满减', startTime: '2026-05-10', endTime: '2026-05-12', participants: 389, status: '已结束' },
];

const campaignTypeColor: Record<string, string> = {
  '限时折扣': 'red',
  '拼团': 'green',
  '满减': 'blue',
  '学员日': 'purple',
  '新人专享': 'orange',
  '早鸟特惠': 'gold',
};

const statusColor: Record<string, string> = {
  '进行中': 'green',
  '未开始': 'orange',
  '已结束': 'default',
};

// ====== 优惠券数据 ======
const couponStats = [
  { title: '优惠券总数', value: 8, icon: <GiftOutlined />, color: '#a855f7' },
  { title: '已发放', value: 1256, icon: <ThunderboltOutlined />, color: '#3b82f6' },
  { title: '已使用', value: 487, icon: <PercentageOutlined />, color: '#10b981' },
];

interface Coupon {
  key: string;
  name: string;
  type: string;
  faceValue: string;
  threshold: string;
  startDate: string;
  endDate: string;
  issued: number;
  used: number;
  status: string;
}

type CommissionSummary = {
  pending_amount?: unknown;
  available_amount?: unknown;
  withdrawn_amount?: unknown;
};

const coupons: Coupon[] = [
  { key: '1', name: '新用户专享券', type: '新人券', faceValue: '¥50', threshold: '满199可用', startDate: '2026-05-01', endDate: '2026-06-30', issued: 520, used: 203, status: '生效中' },
  { key: '2', name: '满199减30', type: '满减券', faceValue: '¥30', threshold: '满199可用', startDate: '2026-05-01', endDate: '2026-05-31', issued: 300, used: 142, status: '生效中' },
  { key: '3', name: '满399减80', type: '满减券', faceValue: '¥80', threshold: '满399可用', startDate: '2026-05-15', endDate: '2026-06-15', issued: 200, used: 67, status: '生效中' },
  { key: '4', name: '8折优惠券', type: '折扣券', faceValue: '8折', threshold: '无门槛', startDate: '2026-05-20', endDate: '2026-05-31', issued: 150, used: 48, status: '生效中' },
  { key: '5', name: '学员日专属券', type: '折扣券', faceValue: '7折', threshold: '满299可用', startDate: '2026-05-25', endDate: '2026-05-25', issued: 56, used: 12, status: '未开始' },
  { key: '6', name: '老带新礼券', type: '新人券', faceValue: '¥100', threshold: '满299可用', startDate: '2026-05-01', endDate: '2026-07-31', issued: 30, used: 15, status: '生效中' },
  { key: '7', name: '试听课转化券', type: '新人券', faceValue: '¥20', threshold: '无门槛', startDate: '2026-04-01', endDate: '2026-04-30', issued: 200, used: 78, status: '已过期' },
  { key: '8', name: '月度全品类券', type: '满减券', faceValue: '¥50', threshold: '满499可用', startDate: '2026-05-01', endDate: '2026-05-31', issued: 100, used: 32, status: '生效中' },
];

const couponStatusColor: Record<string, string> = {
  '生效中': 'green',
  '未开始': 'orange',
  '已过期': 'default',
};

// ====== 促销规则数据 ======
const ruleStats = [
  { title: '满减规则', value: 2, icon: <GiftOutlined />, color: '#a855f7' },
  { title: '拼团规则', value: 2, icon: <TeamOutlined />, color: '#3b82f6' },
  { title: '早鸟价', value: 3, icon: <FireOutlined />, color: '#f59e0b' },
];

export default function MarketingPage() {
  // ============ 优惠券弹窗状态 ============
  const [couponModalOpen, setCouponModalOpen] = useState(false);
  const [commissions, setCommissions] = useState<UnknownRecord[]>([]);
  const [commissionSummary, setCommissionSummary] = useState<CommissionSummary>({});
  const [commissionLoading, setCommissionLoading] = useState(false);
  const [couponForm] = Form.useForm();

  useEffect(() => {
    setCommissionLoading(true);
    onlineCourseApi.getCommissions({ member_id: 1 })
      .then((payload) => {
        setCommissions(pickArray<UnknownRecord>(payload));
        setCommissionSummary(isRecord(payload) && isRecord(payload.summary) ? payload.summary : {});
      })
      .catch(() => {
        setCommissions([]);
        setCommissionSummary({});
      })
      .finally(() => setCommissionLoading(false));
  }, []);

  const commissionTotal = Number(commissionSummary.pending_amount || 0) + Number(commissionSummary.available_amount || 0) + Number(commissionSummary.withdrawn_amount || 0);

  const campaignColumns = [
    { title: '活动名称', dataIndex: 'name', width: 160 },
    {
      title: '类型',
      dataIndex: 'type',
      width: 100,
      render: (v: string) => <Tag color={campaignTypeColor[v] || 'default'}>{v}</Tag>,
    },
    { title: '开始时间', dataIndex: 'startTime', width: 110 },
    { title: '结束时间', dataIndex: 'endTime', width: 110 },
    { title: '参与人数', dataIndex: 'participants', width: 90 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (v: string) => <Tag color={statusColor[v] || 'default'}>{v}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: () => (
        <Space size="small">
          <Button type="link" size="small" style={{ color: '#a855f7' }}>查看</Button>
          <Button type="link" size="small">编辑</Button>
          <Button type="link" size="small" danger>停止</Button>
        </Space>
      ),
    },
  ];

  const couponColumns = [
    { title: '券名称', dataIndex: 'name', width: 140 },
    {
      title: '类型',
      dataIndex: 'type',
      width: 90,
      render: (v: string) => {
        const m: Record<string, string> = { '满减券': 'blue', '折扣券': 'purple', '新人券': 'orange' };
        return <Tag color={m[v] || 'default'}>{v}</Tag>;
      },
    },
    { title: '面值', dataIndex: 'faceValue', width: 70 },
    { title: '使用门槛', dataIndex: 'threshold', width: 100 },
    { title: '开始日', dataIndex: 'startDate', width: 100 },
    { title: '结束日', dataIndex: 'endDate', width: 100 },
    { title: '发放数', dataIndex: 'issued', width: 70 },
    { title: '使用数', dataIndex: 'used', width: 70 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (v: string) => <Tag color={couponStatusColor[v] || 'default'}>{v}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: () => (
        <Space size="small">
          <Button type="link" size="small" style={{ color: '#a855f7' }}>编辑</Button>
          <Button type="link" size="small" danger>停用</Button>
        </Space>
      ),
    },
  ];

  const commissionColumns = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: '获得者', dataIndex: 'member_id', width: 110 },
    { title: '订单', dataIndex: 'order_no', width: 160, render: (value: string) => value || '-' },
    { title: '课程', dataIndex: 'series_name', width: 220, className: 'course-name-column', render: (value: string) => value || '-' },
    { title: '层级', dataIndex: 'level', width: 90, render: (value: number) => <Tag color={value === 1 ? 'green' : 'blue'}>{value === 1 ? '一级' : '二级'}</Tag> },
    { title: '金额', dataIndex: 'amount', align: 'right' as const, width: 110, render: money },
    { title: '比例', dataIndex: 'rate', align: 'right' as const, width: 90, render: (value: number) => `${Math.round(Number(value || 0) * 100)}%` },
    { title: '状态', dataIndex: 'status', width: 100, render: (value: string) => <Tag color={value === 'available' ? 'green' : value === 'withdrawn' ? 'default' : 'orange'}>{value || '-'}</Tag> },
    { title: '创建时间', dataIndex: 'created_at', width: 160, render: (value: string) => value ? String(value).slice(0, 16) : '-' },
  ];

  const tabItems = [
    {
      key: 'campaigns',
      label: '营销活动',
      children: (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            {campaignStats.map((s, i) => (
              <Col span={6} key={i}>
                <Card hoverable>
                  <Statistic
                    title={s.title}
                    value={s.value}
                    prefix={s.icon}
                    valueStyle={{ color: s.color, fontSize: 28 }}
                  />
                </Card>
              </Col>
            ))}
          </Row>
          <Card title="活动列表" extra={<Button type="primary" style={{ background: '#a855f7', borderColor: '#a855f7' }} icon={<PlusOutlined />}>新增活动</Button>}>
            <Table
              columns={campaignColumns}
              dataSource={campaigns}
              pagination={{ pageSize: 8, showTotal: (t: number) => `共 ${t} 条` }}
              scroll={{ x: 860 }}
              size="middle"
            />
          </Card>
        </>
      ),
    },
    {
      key: 'coupons',
      label: '优惠券管理',
      children: (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            {couponStats.map((s, i) => (
              <Col span={8} key={i}>
                <Card hoverable>
                  <Statistic
                    title={s.title}
                    value={s.value}
                    prefix={s.icon}
                    valueStyle={{ color: s.color, fontSize: 28 }}
                  />
                </Card>
              </Col>
            ))}
          </Row>
          <Card
            title="优惠券列表"
            extra={
              <Button
                type="primary"
                style={{ background: '#a855f7', borderColor: '#a855f7' }}
                icon={<PlusOutlined />}
                onClick={() => setCouponModalOpen(true)}
              >
                新增优惠券
              </Button>
            }
          >
            <Table
              columns={couponColumns}
              dataSource={coupons}
              pagination={{ pageSize: 8, showTotal: (t: number) => `共 ${t} 条` }}
              scroll={{ x: 870 }}
              size="middle"
            />
          </Card>

          {/* 新增优惠券弹窗 */}
          <Modal
            title="新增优惠券"
            open={couponModalOpen}
            onCancel={() => {
              setCouponModalOpen(false);
              couponForm.resetFields();
            }}
            onOk={() => couponForm.submit()}
            okButtonProps={{ style: { background: '#a855f7', borderColor: '#a855f7' } }}
            width={560}
          >
            <Form
              form={couponForm}
              layout="vertical"
              style={{ marginTop: 16 }}
              onFinish={() => {
                setCouponModalOpen(false);
                couponForm.resetFields();
              }}
            >
              <Form.Item name="name" label="券名称" rules={[{ required: true, message: '请输入券名称' }]}>
                <Input placeholder="如：满199减30" />
              </Form.Item>
              <Row gutter={16}>
                <Col xs={12} sm={12}>
                  <Form.Item name="type" label="类型" rules={[{ required: true, message: '请选择类型' }]}>
                    <Select placeholder="选择类型" options={[
                      { label: '满减券', value: '满减券' },
                      { label: '折扣券', value: '折扣券' },
                      { label: '新人券', value: '新人券' },
                    ]} />
                  </Form.Item>
                </Col>
                <Col xs={12} sm={12}>
                  <Form.Item name="faceValue" label="面值" rules={[{ required: true, message: '请输入面值' }]}>
                    <Input placeholder="如：30 或 8折" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col xs={12} sm={12}>
                  <Form.Item name="threshold" label="使用门槛" rules={[{ required: true, message: '请输入门槛' }]}>
                    <InputNumber placeholder="如：199" min={0} style={{ width: '100%' }} addonBefore="¥" />
                  </Form.Item>
                </Col>
                <Col xs={12} sm={12}>
                  <Form.Item name="quantity" label="发放数量">
                    <InputNumber placeholder="数量" min={1} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col xs={12} sm={12}>
                  <Form.Item name="startDate" label="生效日期" rules={[{ required: true, message: '请选择日期' }]}>
                    <DatePicker style={{ width: '100%' }} placeholder="开始日期" />
                  </Form.Item>
                </Col>
                <Col xs={12} sm={12}>
                  <Form.Item name="endDate" label="失效日期" rules={[{ required: true, message: '请选择日期' }]}>
                    <DatePicker style={{ width: '100%' }} placeholder="结束日期" />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </Modal>
        </>
      ),
    },
    {
      key: 'distribution',
      label: `分销系统 ${commissions.length}`,
      children: (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={6}><Card><Statistic title="总佣金" value={money(commissionTotal)} valueStyle={{ color: '#a855f7' }} /></Card></Col>
            <Col xs={24} md={6}><Card><Statistic title="可提现" value={money(Number(commissionSummary.available_amount || 0))} valueStyle={{ color: '#10b981' }} /></Card></Col>
            <Col xs={24} md={6}><Card><Statistic title="待处理" value={money(Number(commissionSummary.pending_amount || 0))} valueStyle={{ color: '#f59e0b' }} /></Card></Col>
            <Col xs={24} md={6}><Card><Statistic title="已提现" value={money(Number(commissionSummary.withdrawn_amount || 0))} /></Card></Col>
          </Row>
          <Card title={<Space><DollarOutlined />佣金记录</Space>}>
            <Table
              rowKey="id"
              size="middle"
              loading={commissionLoading}
              dataSource={commissions}
              columns={commissionColumns}
              pagination={{ pageSize: 20, showTotal: (t: number) => `共 ${t} 条` }}
              scroll={{ x: 960 }}
              locale={{ emptyText: <Empty description="暂无佣金记录" /> }}
            />
          </Card>
        </Space>
      ),
    },
    {
      key: 'rules',
      label: '促销规则',
      children: (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            {ruleStats.map((s, i) => (
              <Col span={8} key={i}>
                <Card hoverable>
                  <Statistic
                    title={s.title}
                    value={s.value}
                    prefix={s.icon}
                    valueStyle={{ color: s.color, fontSize: 28 }}
                  />
                </Card>
              </Col>
            ))}
          </Row>
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <Card
                title={<Space><Tag color="blue">满减</Tag> 满减规则</Space>}
                extra={<Button type="link" style={{ color: '#a855f7' }}>编辑规则</Button>}
                style={{ marginBottom: 16 }}
              >
                <Row gutter={[24, 16]}>
                  <Col span={12}>
                    <Card size="small" style={{ background: '#f9fafb' }}>
                      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>满199减30</div>
                      <div style={{ color: '#6b7280', fontSize: 13 }}>适用：全部课程 | 生效时间：全年</div>
                      <div style={{ color: '#6b7280', fontSize: 13 }}>叠加规则：不可与其他优惠券叠加</div>
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card size="small" style={{ background: '#f9fafb' }}>
                      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>满399减80</div>
                      <div style={{ color: '#6b7280', fontSize: 13 }}>适用：年卡/半年卡 | 生效时间：全年</div>
                      <div style={{ color: '#6b7280', fontSize: 13 }}>叠加规则：可与学员折扣叠加</div>
                    </Card>
                  </Col>
                </Row>
              </Card>
            </Col>
            <Col span={24}>
              <Card
                title={<Space><Tag color="green">拼团</Tag> 拼团规则</Space>}
                extra={<Button type="link" style={{ color: '#a855f7' }}>编辑规则</Button>}
                style={{ marginBottom: 16 }}
              >
                <Row gutter={[24, 16]}>
                  <Col span={12}>
                    <Card size="small" style={{ background: '#f9fafb' }}>
                      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>2人团享9折</div>
                      <div style={{ color: '#6b7280', fontSize: 13 }}>适用：线上学院全部课程 | 成团时限：48小时</div>
                      <div style={{ color: '#6b7280', fontSize: 13 }}>团长奖励：额外赠送30元优惠券</div>
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card size="small" style={{ background: '#f9fafb' }}>
                      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>3人团享8折</div>
                      <div style={{ color: '#6b7280', fontSize: 13 }}>适用：线下培训课程 | 成团时限：72小时</div>
                      <div style={{ color: '#6b7280', fontSize: 13 }}>团长奖励：额外赠送50元优惠券</div>
                    </Card>
                  </Col>
                </Row>
              </Card>
            </Col>
            <Col span={24}>
              <Card
                title={<Space><Tag color="gold">早鸟价</Tag> 早鸟价规则</Space>}
                extra={<Button type="link" style={{ color: '#a855f7' }}>编辑规则</Button>}
              >
                <Row gutter={[24, 16]}>
                  <Col span={8}>
                    <Card size="small" style={{ background: '#f9fafb' }}>
                      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>预售7折</div>
                      <div style={{ color: '#6b7280', fontSize: 13 }}>开课前30天报名 | 适用：新课上线</div>
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card size="small" style={{ background: '#f9fafb' }}>
                      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>预售8折</div>
                      <div style={{ color: '#6b7280', fontSize: 13 }}>开课前15天报名 | 适用：常规课程</div>
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card size="small" style={{ background: '#f9fafb' }}>
                      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>预售9折</div>
                      <div style={{ color: '#6b7280', fontSize: 13 }}>开课前7天报名 | 适用：全部课程</div>
                    </Card>
                  </Col>
                </Row>
              </Card>
            </Col>
          </Row>
        </>
      ),
    },
  ];

  return (
    <>
      <h2 style={{ marginBottom: 20, color: '#1f2937' }}>营销中心</h2>
      <Tabs
        defaultActiveKey="campaigns"
        items={tabItems}
        tabBarStyle={{ marginBottom: 0 }}
        tabBarExtraContent={
          <Button type="primary" style={{ background: '#a855f7', borderColor: '#a855f7' }} icon={<PlusOutlined />}>
            新建营销活动
          </Button>
        }
      />
    </>
  );
}
