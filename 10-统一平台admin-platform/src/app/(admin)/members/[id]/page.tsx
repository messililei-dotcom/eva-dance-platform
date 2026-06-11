'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Alert, Avatar, Button, Card, Col, Descriptions, Empty, Progress, Row, Space, Spin, Statistic, Table, Tabs, Tag, Typography } from 'antd';
import {
  ArrowLeftOutlined,
  BookOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  DollarOutlined,
  HistoryOutlined,
  PhoneOutlined,
  PlayCircleOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { platformAdapter } from '@/lib/adapters/platform';
import { formatPaymentAmount } from '@/lib/money-format';
import { sortableColumns } from '@/lib/table-sort';
import type { MemberProfile360 } from '@/types/domain';

const { Text, Title } = Typography;

function money(value: unknown) {
  return formatPaymentAmount(value);
}

function dateText(value: unknown) {
  const text = String(value || '').slice(0, 10);
  return text || '-';
}

function statusTag(value: unknown) {
  const status = String(value || 'paid');
  const color = ['paid', 'completed', 'success', '已支付', '已完成', 'active'].includes(status) ? 'green' : status.includes('refund') || status.includes('退') ? 'blue' : 'orange';
  return <Tag color={color}>{status}</Tag>;
}

export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<MemberProfile360 | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError('');
    platformAdapter.getMemberProfile(id)
      .then(setData)
      .catch((err) => {
        setData(null);
        setError(err?.response?.data?.error || err?.message || '学员信息加载失败');
      })
      .finally(() => setLoading(false));
  }, [id]);

  const progressStats = useMemo(() => {
    const progress = data?.progress || [];
    const completed = progress.filter(item => Number(item.completed) === 1).length;
    return {
      completed,
      total: progress.length,
      percent: progress.length ? Math.round(completed / progress.length * 100) : 0,
    };
  }, [data]);

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  if (error) return <Alert type="error" message="学员信息加载失败" description={error} showIcon />;
  if (!data?.member?.id) return <Alert type="warning" message="学员不存在" showIcon />;

  const { member, summary } = data;
  const region = [member.country, member.province, member.city || member.foreignRegion].filter(Boolean).join(' / ') || '-';
  const totalFinance = Number(summary.totalIncome || 0) + Number(summary.financeIncome || 0) + Number(summary.financeOrderAmount || 0);

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/members')}>返回学员信息</Button>
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[20, 20]} align="middle">
          <Col>
            <Avatar size={72} style={{ background: 'linear-gradient(135deg,#F72A8A,#7C3AED)', fontSize: 28, fontWeight: 700 }}>
              {String(member.name || '?')[0]}
            </Avatar>
          </Col>
          <Col flex="auto">
            <Title level={3} style={{ margin: 0 }}>{member.name || '未知学员'}</Title>
            <Space wrap style={{ marginTop: 10 }}>
              <Tag icon={<PhoneOutlined />}>{member.phone || '未绑定手机号'}</Tag>
              <Tag icon={<UserOutlined />} color="magenta">{String(member.level || '普通学员').replace(/会员/g, '学员')}</Tag>
              {statusTag(member.status || 'active')}
              <Tag icon={<CalendarOutlined />}>{dateText(member.register_date || member.created_at)}</Tag>
            </Space>
          </Col>
          <Col xs={12} md={4}><Statistic title="综合收入" value={totalFinance} formatter={value => money(value)} prefix={<DollarOutlined />} valueStyle={{ color: '#F72A8A' }} /></Col>
          <Col xs={12} md={4}><Statistic title="核销课次" value={summary.consumeCount || 0} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#22C55E' }} /></Col>
          <Col xs={12} md={4}><Statistic title="已学视频" value={summary.completedVideoCount || 0} prefix={<PlayCircleOutlined />} valueStyle={{ color: '#3B82F6' }} /></Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={6}><Card><Statistic title="线下缴费" value={summary.offlineIncome || 0} formatter={value => money(value)} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="网课订单" value={summary.onlineIncome || 0} formatter={value => money(value)} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="财务收入" value={summary.financeIncome || 0} formatter={value => money(value)} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="授权课程" value={summary.authorizationCount || 0} prefix={<BookOutlined />} /></Card></Col>
      </Row>

      <Tabs
        defaultActiveKey="profile"
        items={[
          {
            key: 'profile',
            label: '基础档案',
            children: (
              <Row gutter={[16, 16]}>
                <Col xs={24} xl={14}>
                  <Card title="学员资料">
                    <Descriptions column={2} size="small">
                      <Descriptions.Item label="姓名">{member.name || '-'}</Descriptions.Item>
                      <Descriptions.Item label="手机号">{member.phone || '-'}</Descriptions.Item>
                      <Descriptions.Item label="性别">{member.gender || '-'}</Descriptions.Item>
                      <Descriptions.Item label="生日">{dateText(member.birthday)}</Descriptions.Item>
                      <Descriptions.Item label="等级">{String(member.level || '-').replace(/会员/g, '学员')}</Descriptions.Item>
                      <Descriptions.Item label="成长值">{member.growth || 0}</Descriptions.Item>
                      <Descriptions.Item label="地区">{region}</Descriptions.Item>
                      <Descriptions.Item label="详细地址" span={2}>{member.address || member.raw?.address || '-'}</Descriptions.Item>
                      <Descriptions.Item label="登记日期">{dateText(member.register_date || member.created_at)}</Descriptions.Item>
                      <Descriptions.Item label="推荐人">{member.referrer || '-'}</Descriptions.Item>
                      <Descriptions.Item label="舞蹈经验">{member.dance_experience || '-'}</Descriptions.Item>
                      <Descriptions.Item label="备注" span={2}>{member.remark || '-'}</Descriptions.Item>
                    </Descriptions>
                  </Card>
                </Col>
                <Col xs={24} xl={10}>
                  <Card title="学习进度">
                    <Progress percent={progressStats.percent} strokeColor={{ '0%': '#F72A8A', '100%': '#7C3AED' }} />
                    <Row gutter={12} style={{ marginTop: 16 }}>
                      <Col span={12}><Statistic title="进度记录" value={progressStats.total} /></Col>
                      <Col span={12}><Statistic title="完成视频" value={progressStats.completed} /></Col>
                    </Row>
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: 'payments',
            label: `线下缴费 ${data.offlinePayments.length}`,
            children: (
              <Card styles={{ body: { padding: 0 } }}>
                <Table
                  scroll={{ x: 'max-content' }}
                  rowKey={(record: any) => String(record.id)}
                  size="middle"
                  dataSource={data.offlinePayments}
                  pagination={{ pageSize: 10 }}
                  locale={{ emptyText: <Empty description="暂无线下缴费" /> }}
                  columns={sortableColumns<any>([
                    { title: '课程', dataIndex: 'courseName', ellipsis: true, className: 'course-name-column' },
                    { title: '金额', dataIndex: 'amount', width: 120, align: 'right' as const, render: money },
                    { title: '支付方式', dataIndex: 'payment', width: 120 },
                    { title: '状态', dataIndex: 'paymentStatus', width: 120, render: statusTag },
                    { title: '剩余课次', dataIndex: 'remainingSessions', width: 110 },
                    { title: '日期', dataIndex: 'date', width: 130, render: dateText },
                    { title: '备注', dataIndex: 'remark', ellipsis: true },
                  ])}
                />
              </Card>
            ),
          },
          {
            key: 'consume',
            label: `核销记录 ${data.consumeRecords.length}`,
            children: (
              <Card styles={{ body: { padding: 0 } }}>
                <Table
                  scroll={{ x: 'max-content' }}
                  rowKey={(record: any) => String(record.id)}
                  size="middle"
                  dataSource={data.consumeRecords}
                  pagination={{ pageSize: 10 }}
                  locale={{ emptyText: <Empty description="暂无核销记录" /> }}
                  columns={sortableColumns<any>([
                    { title: '课程', dataIndex: 'courseName', ellipsis: true, className: 'course-name-column' },
                    { title: '核销次数', dataIndex: 'count', width: 110 },
                    { title: '剩余', dataIndex: 'remainingAfter', width: 90 },
                    { title: '日期', dataIndex: 'consumeDate', width: 130, render: dateText },
                    { title: '操作人', dataIndex: 'operator', width: 120 },
                    { title: '备注', dataIndex: 'remark', ellipsis: true },
                  ])}
                />
              </Card>
            ),
          },
          {
            key: 'online',
            label: `网课与授权 ${data.courseOrders.length + data.authorizations.length}`,
            children: (
              <Row gutter={[16, 16]}>
                <Col xs={24} xl={12}>
                  <Card title="网课订单" styles={{ body: { padding: 0 } }}>
                    <Table
                      scroll={{ x: 'max-content' }}
                      rowKey={(record: any) => String(record.id)}
                      size="small"
                      dataSource={data.courseOrders}
                      pagination={{ pageSize: 8 }}
                      locale={{ emptyText: <Empty description="暂无网课订单" /> }}
                      columns={sortableColumns<any>([
                        { title: '课程', dataIndex: 'series_name', ellipsis: true, className: 'course-name-column' },
                        { title: '金额', dataIndex: 'amount', width: 100, align: 'right' as const, render: money },
                        { title: '状态', dataIndex: 'status', width: 100, render: statusTag },
                        { title: '日期', dataIndex: 'created_at', width: 120, render: dateText },
                      ])}
                    />
                  </Card>
                </Col>
                <Col xs={24} xl={12}>
                  <Card title="课程授权" styles={{ body: { padding: 0 } }}>
                    <Table
                      scroll={{ x: 'max-content' }}
                      rowKey={(record: any) => String(record.id)}
                      size="small"
                      dataSource={data.authorizations}
                      pagination={{ pageSize: 8 }}
                      locale={{ emptyText: <Empty description="暂无课程授权" /> }}
                      columns={sortableColumns<any>([
                        { title: '课程', dataIndex: 'series_name', ellipsis: true, className: 'course-name-column' },
                        { title: '授权方式', dataIndex: 'type', width: 110 },
                        { title: '状态', dataIndex: 'status', width: 100, render: statusTag },
                        { title: '授权时间', dataIndex: 'granted_at', width: 130, render: dateText },
                      ])}
                    />
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: 'finance',
            label: `财务记录 ${data.financeIncomes.length + data.financeOrders.length}`,
            children: (
              <Row gutter={[16, 16]}>
                <Col xs={24} xl={12}>
                  <Card title={<Space><DollarOutlined />收入流水</Space>} styles={{ body: { padding: 0 } }}>
                    <Table
                      scroll={{ x: 'max-content' }}
                      rowKey={(record: any) => String(record.id)}
                      size="small"
                      dataSource={data.financeIncomes}
                      pagination={{ pageSize: 8 }}
                      locale={{ emptyText: <Empty description="暂无收入流水" /> }}
                      columns={sortableColumns<any>([
                        { title: '项目', dataIndex: 'category', ellipsis: true },
                        { title: '金额', dataIndex: 'amount', width: 110, align: 'right' as const, render: money },
                        { title: '日期', dataIndex: 'incomeDate', width: 130, render: dateText },
                        { title: '备注', dataIndex: 'remark', ellipsis: true },
                      ])}
                    />
                  </Card>
                </Col>
                <Col xs={24} xl={12}>
                  <Card title={<Space><SafetyCertificateOutlined />财务订单</Space>} styles={{ body: { padding: 0 } }}>
                    <Table
                      scroll={{ x: 'max-content' }}
                      rowKey={(record: any) => String(record.id)}
                      size="small"
                      dataSource={data.financeOrders}
                      pagination={{ pageSize: 8 }}
                      locale={{ emptyText: <Empty description="暂无财务订单" /> }}
                      columns={sortableColumns<any>([
                        { title: '订单号', dataIndex: 'orderNo', ellipsis: true },
                        { title: '项目', dataIndex: 'productName', ellipsis: true },
                        { title: '金额', dataIndex: 'amount', width: 110, align: 'right' as const, render: money },
                        { title: '状态', dataIndex: 'paidStatus', width: 100, render: statusTag },
                      ])}
                    />
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: 'logs',
            label: `操作轨迹 ${data.operationLogs.length}`,
            children: (
              <Card title={<Space><HistoryOutlined />相关操作日志</Space>} styles={{ body: { padding: 0 } }}>
                <Table
                  scroll={{ x: 'max-content' }}
                  rowKey={(record: any) => String(record.id)}
                  size="small"
                  dataSource={data.operationLogs}
                  pagination={{ pageSize: 12 }}
                  locale={{ emptyText: <Empty description="暂无操作日志" /> }}
                  columns={sortableColumns<any>([
                    { title: '时间', dataIndex: 'time', width: 180 },
                    { title: '操作人', dataIndex: 'operator', width: 120 },
                    { title: '类型', dataIndex: 'type', width: 90, render: value => <Tag>{value}</Tag> },
                    { title: '模块', dataIndex: 'module', width: 120 },
                    { title: '详情', dataIndex: 'detail', ellipsis: true },
                  ])}
                />
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
}
