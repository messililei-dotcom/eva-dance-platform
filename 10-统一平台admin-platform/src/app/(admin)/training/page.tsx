'use client';
import { useEffect, useMemo, useState } from 'react';
import { Card, Col, Empty, Input, Progress, Row, Select, Spin, Statistic, Table, Tabs, Tag, Typography } from 'antd';
import { CalendarOutlined, CheckCircleOutlined, SearchOutlined, TeamOutlined } from '@ant-design/icons';
import { platformAdapter } from '@/lib/adapters/platform';
import type { Course, UnifiedOrder } from '@/types/domain';

const { Text, Title } = Typography;

function money(value: number) {
  return `¥${Number(value || 0).toLocaleString()}`;
}

function statusTag(status: string) {
  const map: Record<string, { color: string; label: string }> = {
    active: { color: 'green', label: '招生中' },
    completed: { color: 'blue', label: '已结课' },
    draft: { color: 'default', label: '草稿' },
  };
  const item = map[status] || { color: 'orange', label: status || '-' };
  return <Tag color={item.color}>{item.label}</Tag>;
}

export default function TrainingPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [orders, setOrders] = useState<UnifiedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('all');

  useEffect(() => {
    Promise.all([
      platformAdapter.getCourses(),
      platformAdapter.getOrders({ type: 'training' }).catch(() => []),
    ])
      .then(([courseData, orderData]) => {
        setCourses(courseData.offline);
        setOrders(orderData.filter(order => order.orderType === 'training' || order.sourceType === 'offline_payment'));
      })
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => ['all', ...Array.from(new Set(courses.map(item => item.category).filter(Boolean)))], [courses]);
  const filteredCourses = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return courses.filter(item => {
      const matchKeyword = !q || [item.name, item.teacher, item.category, item.level].some(value => value.toLowerCase().includes(q));
      const matchCategory = category === 'all' || item.category === category;
      return matchKeyword && matchCategory;
    });
  }, [courses, keyword, category]);

  const activeCourses = courses.filter(item => ['active', '招生中', 'published'].includes(item.status)).length;
  const totalStudents = courses.reduce((sum, item) => sum + item.students, 0);
  const courseRevenue = orders.reduce((sum, item) => sum + item.amount, 0);

  if (loading) return <div style={{ padding: 80, textAlign: 'center' }}><Spin size="large" /></div>;

  return (
    <div>
      <div className="page-header">
        <Title level={2}>线下培训</Title>
        <Text type="secondary">基于旧学员系统课程、缴费和课消数据，统一管理集训、次卡、年卡与传承弟子班。</Text>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={6}><Card><Statistic title="线下课程" value={courses.length} prefix={<TeamOutlined />} suffix="期" /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="招生中" value={activeCourses} prefix={<CalendarOutlined />} valueStyle={{ color: '#22C55E' }} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="累计学员" value={totalStudents} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#F72A8A' }} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="线下收入" value={courseRevenue} prefix="¥" valueStyle={{ color: '#7C3AED' }} /></Card></Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} md={12}><Input prefix={<SearchOutlined />} placeholder="搜索课程、老师、类型、级别" value={keyword} onChange={event => setKeyword(event.target.value)} allowClear /></Col>
          <Col xs={24} md={6}><Select value={category} onChange={setCategory} style={{ width: '100%' }} options={categories.map(item => ({ value: item, label: item === 'all' ? '全部类型' : item }))} /></Col>
          <Col xs={24} md={6}><Text type="secondary">筛选结果：<Text strong>{filteredCourses.length}</Text> 期</Text></Col>
        </Row>
      </Card>

      <Tabs
        items={[
          {
            key: 'classes',
            label: `培训班 ${filteredCourses.length}`,
            children: (
              <Card bodyStyle={{ padding: 0 }}>
                <Table
                  rowKey="id"
                  size="middle"
                  dataSource={filteredCourses}
                  scroll={{ x: 1080 }}
                  pagination={{ pageSize: 15, showSizeChanger: true }}
                  locale={{ emptyText: <Empty description="暂无线下培训数据" /> }}
                  columns={[
                    { title: '培训班', dataIndex: 'name', fixed: 'left', width: 260, render: value => <Text strong>{value}</Text> },
                    { title: '类型', dataIndex: 'category', width: 120, render: value => <Tag color="magenta">{value}</Tag> },
                    { title: '老师', dataIndex: 'teacher', width: 100 },
                    { title: '级别', dataIndex: 'level', width: 110 },
                    { title: '课次', dataIndex: 'sessions', align: 'right' as const, width: 80 },
                    { title: '已报', dataIndex: 'students', align: 'right' as const, width: 80 },
                    { title: '容量', dataIndex: 'capacity', align: 'right' as const, width: 80, render: value => value || '-' },
                    { title: '报名率', width: 140, render: (_, record) => <Progress percent={record.capacity ? Math.min(Math.round(record.students / record.capacity * 100), 100) : 0} size="small" /> },
                    { title: '价格', dataIndex: 'price', align: 'right' as const, width: 110, render: money },
                    { title: '开始日期', dataIndex: 'startDate', width: 120 },
                    { title: '状态', dataIndex: 'status', width: 100, render: statusTag },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: 'payments',
            label: `缴费 ${orders.length}`,
            children: (
              <Card bodyStyle={{ padding: 0 }}>
                <Table
                  rowKey="id"
                  size="middle"
                  dataSource={orders}
                  scroll={{ x: 980 }}
                  pagination={{ pageSize: 15 }}
                  locale={{ emptyText: <Empty description="暂无线下缴费数据" /> }}
                  columns={[
                    { title: '单号', dataIndex: 'orderNo', width: 150 },
                    { title: '学员', dataIndex: 'memberName', width: 120 },
                    { title: '手机号', dataIndex: 'memberPhone', width: 130 },
                    { title: '课程', dataIndex: 'title', ellipsis: true, width: 260 },
                    { title: '金额', dataIndex: 'amount', align: 'right' as const, width: 120, render: value => <Text strong style={{ color: '#F72A8A' }}>{money(value)}</Text> },
                    { title: '方式', dataIndex: 'payMethod', width: 100 },
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
