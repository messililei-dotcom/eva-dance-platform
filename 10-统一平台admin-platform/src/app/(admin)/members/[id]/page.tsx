'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, Table, Tag, Descriptions, Button, Space, Typography, Spin, Alert, Divider, Progress, Row, Col, Statistic, Tabs } from 'antd';
import { ArrowLeftOutlined, PhoneOutlined, EnvironmentOutlined, CalendarOutlined, DollarOutlined, TrophyOutlined, PlayCircleOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { eduApi } from '@/lib/api';

export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      setLoading(true);
      eduApi.getMemberDetails(Number(id))
        .then(setData)
        .catch(() => {
          // Fallback to mock data
          const mock = getMockMember(Number(id));
          setData(mock);
        })
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>;
  if (error) return <Alert type="error" message={error} />;
  if (!data) return <Alert type="warning" message="学员不存在" />;

  const { member, payments, consumes, certificates } = data;

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/members')}>返回会员中心</Button>
      </Space>

      {/* 基础信息 */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={24} align="middle">
          <Col>
            <div style={{
              width: 72, height: 72, borderRadius: 36,
              background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, color: '#fff', fontWeight: 700
            }}>{member.name?.[0] || '?'}</div>
          </Col>
          <Col flex="auto">
            <Typography.Title level={4} style={{ margin: 0 }}>{member.name}</Typography.Title>
            <Space style={{ marginTop: 8 }}>
              <Tag icon={<PhoneOutlined />}>{member.phone || '未绑定'}</Tag>
              <Tag>{member.level || '体验学员'}</Tag>
              {member.status === 'active' ? <Tag color="green">正常</Tag> : <Tag color="red">停用</Tag>}
            </Space>
          </Col>
          <Col>
            <Statistic title="剩余课次" value={member.remaining_hours || 0} suffix="次" valueStyle={{ color: '#a855f7' }} />
          </Col>
          <Col>
            <Statistic title="成长值" value={member.growth || 0} suffix="分" />
          </Col>
          <Col>
            <Statistic title="累计缴费" prefix="¥" value={data.stats?.totalAmount || 0} valueStyle={{ color: '#10b981' }} />
          </Col>
        </Row>
      </Card>

      <Tabs defaultActiveKey="payments" items={[
        {
          key: 'info', label: '详细信息',
          children: <Card size="small">
            <Descriptions column={2} size="small">
              <Descriptions.Item label="姓名">{member.name}</Descriptions.Item>
              <Descriptions.Item label="手机号">{member.phone || '-'}</Descriptions.Item>
              <Descriptions.Item label="性别">{member.gender === '女' ? '女' : '男'}</Descriptions.Item>
              <Descriptions.Item label="生日">{member.birthday || '-'}</Descriptions.Item>
              <Descriptions.Item label="等级">{member.level}</Descriptions.Item>
              <Descriptions.Item label="剩余课次">{member.remaining_hours || 0}</Descriptions.Item>
              <Descriptions.Item label="注册日期">{member.register_date || member.created_at?.slice(0, 10) || '-'}</Descriptions.Item>
              <Descriptions.Item label="来源">{member.source || 'manual'}</Descriptions.Item>
              <Descriptions.Item label="地区">{member.province || ''}{member.city || ''}</Descriptions.Item>
              <Descriptions.Item label="推荐人">{member.referrer || '-'}</Descriptions.Item>
              <Descriptions.Item label="舞蹈经验">{member.dance_experience || '-'}</Descriptions.Item>
              <Descriptions.Item label="备注">{member.remark || '-'}</Descriptions.Item>
            </Descriptions>
          </Card>
        },
        {
          key: 'payments', label: `缴费记录 (${payments?.length || 0})`,
          children: <Card size="small">
            <Table dataSource={payments || []} size="small" pagination={false}
              rowKey={(r: any) => r?.id || r?.paymentId} 
              columns={[
                { title: 'ID', dataIndex: 'id', width: 50 },
                { title: '课程', dataIndex: 'courseName', width: 150 },
                { title: '金额', dataIndex: 'amount', width: 80, render: (v: number) => <span style={{ fontWeight: 600, color: '#10b981' }}>¥{v?.toFixed(2)}</span> },
                { title: '支付方式', dataIndex: 'payment', width: 80 },
                { title: '支付状态', dataIndex: 'paymentStatus', width: 80, render: (v: string) => <Tag color={v === 'completed' ? 'green' : 'orange'}>{v === 'completed' ? '已完成' : v}</Tag> },
                { title: '日期', dataIndex: 'date', width: 100 },
              ]} />
          </Card>
        },
        {
          key: 'consume', label: `核销记录 (${consumes?.length || 0})`,
          children: <Card size="small">
            <Table dataSource={consumes || []} size="small" pagination={false}
              rowKey="id"
              columns={[
                { title: '课程', dataIndex: 'courseName', width: 150 },
                { title: '核销次数', dataIndex: 'count', width: 80 },
                { title: '剩余', dataIndex: 'remainingAfter', width: 60 },
                { title: '日期', dataIndex: 'consumeDate', width: 100 },
                { title: '操作人', dataIndex: 'operator', width: 80 },
                { title: '备注', dataIndex: 'remark', ellipsis: true },
              ]} />
          </Card>
        },
        {
          key: 'cert', label: `证书 (${certificates?.length || 0})`,
          children: <Card size="small">
            {certificates?.length > 0 ? (
              <Table dataSource={certificates} size="small" pagination={false}
                rowKey="id"
                columns={[
                  { title: '证书编号', dataIndex: 'certificateNo', width: 150 },
                  { title: '课程名称', dataIndex: 'courseName', width: 200 },
                  { title: '颁发日期', dataIndex: 'issueDate', width: 100 },
                  { title: '状态', dataIndex: 'status', width: 60, render: (v: string) => <Tag color={v === 'active' ? 'gold' : 'default'}>{v === 'active' ? '有效' : v}</Tag> },
                ]} />
            ) : <div style={{ textAlign: 'center', padding: 32, color: '#999' }}>暂无证书</div>}
          </Card>
        },
      ]} />
    </div>
  );
}

// Mock data fallback
function getMockMember(id: number) {
  const names = ['李小雅', '张秀玲', '谢孟辉', '大凤凤', '碧水丛林', '王雨涵', '陈思思', '刘美琪'];
  const name = names[id % names.length];
  return {
    member: { id, name, phone: `1380000${String(id).padStart(4, '0')}`, gender: '女', level: '门徒班', status: 'active', remaining_hours: 20, growth: 85, register_date: '2026-01-15', province: '河北', city: '石家庄', referrer: '伊娃老师', dance_experience: '2年', remark: '优秀学员' },
    payments: Array.from({ length: 5 }, (_, i) => ({ id: i + 1, courseName: ['国际技巧超魔班', '门徒班', '私教课', '入门基础', '舞码精讲'][i], amount: [3980, 8800, 1880, 1280, 680][i], payment: '微信', paymentStatus: 'completed', date: `2026-0${5 - i}-${15 + i}` })),
    consumes: Array.from({ length: 8 }, (_, i) => ({ id: i + 1, courseName: '国际技巧超魔班', count: 1, remainingAfter: 20 - i, consumeDate: `2026-05-${10 + i}`, operator: '伊小琳', remark: '正常核销' })),
    certificates: id === 1 ? [{ id: 1, certificateNo: 'EW-2026-0001', courseName: '师资班·初级', issueDate: '2026-03-15', status: 'active' }] : [],
    stats: { totalPayments: 5, totalAmount: 16620 },
  };
}
