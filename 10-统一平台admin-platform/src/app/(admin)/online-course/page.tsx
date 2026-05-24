'use client';
import { useEffect, useMemo, useState } from 'react';
import { Card, Col, Empty, Input, Progress, Row, Select, Spin, Statistic, Table, Tabs, Tag, Typography } from 'antd';
import { LaptopOutlined, PlayCircleOutlined, SearchOutlined, UserSwitchOutlined } from '@ant-design/icons';
import { platformAdapter } from '@/lib/adapters/platform';
import type { Course, UnifiedOrder } from '@/types/domain';

const { Text, Title } = Typography;

function money(value: number) {
  return `¥${Number(value || 0).toLocaleString()}`;
}

function statusTag(status: string) {
  const map: Record<string, { color: string; label: string }> = {
    published: { color: 'green', label: '已发布' },
    active: { color: 'green', label: '已发布' },
    draft: { color: 'default', label: '草稿' },
    archived: { color: 'orange', label: '已归档' },
  };
  const item = map[status] || { color: 'purple', label: status || '-' };
  return <Tag color={item.color}>{item.label}</Tag>;
}

export default function OnlineCoursePage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [orders, setOrders] = useState<UnifiedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('all');

  useEffect(() => {
    Promise.all([
      platformAdapter.getCourses(),
      platformAdapter.getOrders({ type: 'course' }).catch(() => []),
    ])
      .then(([courseData, orderData]) => {
        setCourses(courseData.online);
        setOrders(orderData.filter(order => order.orderType === 'course' || order.sourceType === 'online_course_order'));
      })
      .finally(() => setLoading(false));
  }, []);

  const statuses = useMemo(() => ['all', ...Array.from(new Set(courses.map(item => item.status).filter(Boolean)))], [courses]);
  const filteredCourses = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return courses.filter(item => {
      const matchKeyword = !q || [item.name, item.teacher, item.category, item.level].some(value => value.toLowerCase().includes(q));
      const matchStatus = status === 'all' || item.status === status;
      return matchKeyword && matchStatus;
    });
  }, [courses, keyword, status]);

  const totalLessons = courses.reduce((sum, item) => sum + item.sessions, 0);
  const authorizedStudents = courses.reduce((sum, item) => sum + item.students, 0);
  const onlineRevenue = orders.reduce((sum, item) => sum + item.amount, 0);

  if (loading) return <div style={{ padding: 80, textAlign: 'center' }}><Spin size="large" /></div>;

  return (
    <div>
      <div className="page-header">
        <Title level={2}>网课系统</Title>
        <Text type="secondary">统一管理线上专栏、课节、订单授权和学员学习入口，数据与课程中心保持一致。</Text>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={6}><Card><Statistic title="线上专栏" value={courses.length} prefix={<LaptopOutlined />} suffix="个" /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="视频课节" value={totalLessons} prefix={<PlayCircleOutlined />} suffix="节" valueStyle={{ color: '#7C3AED' }} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="授权学员" value={authorizedStudents} prefix={<UserSwitchOutlined />} suffix="人" valueStyle={{ color: '#F72A8A' }} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="网课收入" value={onlineRevenue} prefix="¥" valueStyle={{ color: '#22C55E' }} /></Card></Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} md={12}><Input prefix={<SearchOutlined />} placeholder="搜索专栏、老师、分类" value={keyword} onChange={event => setKeyword(event.target.value)} allowClear /></Col>
          <Col xs={24} md={6}><Select value={status} onChange={setStatus} style={{ width: '100%' }} options={statuses.map(item => ({ value: item, label: item === 'all' ? '全部状态' : item }))} /></Col>
          <Col xs={24} md={6}><Text type="secondary">专栏筛选：<Text strong>{filteredCourses.length}</Text> 个</Text></Col>
        </Row>
      </Card>

      <Tabs
        items={[
          {
            key: 'series',
            label: `专栏 ${filteredCourses.length}`,
            children: (
              <Card bodyStyle={{ padding: 0 }}>
                <Table
                  rowKey="id"
                  size="middle"
                  dataSource={filteredCourses}
                  scroll={{ x: 1040 }}
                  pagination={{ pageSize: 15, showSizeChanger: true }}
                  locale={{ emptyText: <Empty description="暂无线上专栏数据；后端未开启网课读取时会显示为空" /> }}
                  columns={[
                    { title: '专栏', dataIndex: 'name', fixed: 'left', width: 260, render: value => <Text strong>{value}</Text> },
                    { title: '分类', dataIndex: 'category', width: 120, render: value => <Tag color="purple">{value}</Tag> },
                    { title: '老师', dataIndex: 'teacher', width: 100 },
                    { title: '课节', dataIndex: 'sessions', align: 'right' as const, width: 80 },
                    { title: '授权', dataIndex: 'students', align: 'right' as const, width: 80 },
                    { title: '价格', dataIndex: 'price', align: 'right' as const, width: 110, render: money },
                    { title: '学习热度', width: 150, render: (_, record) => <Progress percent={Math.min(record.students * 2, 100)} size="small" strokeColor="#7C3AED" /> },
                    { title: '上架时间', dataIndex: 'startDate', width: 120 },
                    { title: '状态', dataIndex: 'status', width: 100, render: statusTag },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: 'orders',
            label: `授权订单 ${orders.length}`,
            children: (
              <Card bodyStyle={{ padding: 0 }}>
                <Table
                  rowKey="id"
                  size="middle"
                  dataSource={orders}
                  scroll={{ x: 960 }}
                  pagination={{ pageSize: 15 }}
                  locale={{ emptyText: <Empty description="暂无网课授权订单" /> }}
                  columns={[
                    { title: '订单号', dataIndex: 'orderNo', width: 150 },
                    { title: '学员', dataIndex: 'memberName', width: 120 },
                    { title: '手机号', dataIndex: 'memberPhone', width: 130 },
                    { title: '专栏', dataIndex: 'title', ellipsis: true, width: 260 },
                    { title: '金额', dataIndex: 'amount', align: 'right' as const, width: 120, render: value => <Text strong style={{ color: '#F72A8A' }}>{money(value)}</Text> },
                    { title: '支付方式', dataIndex: 'payMethod', width: 100 },
                    { title: '状态', dataIndex: 'status', width: 100, render: value => <Tag color="green">{value}</Tag> },
                    { title: '日期', dataIndex: 'orderDate', width: 120 },
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
