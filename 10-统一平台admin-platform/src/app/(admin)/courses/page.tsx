'use client';
import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Empty, Input, Row, Space, Spin, Statistic, Table, Tabs, Tag, Typography } from 'antd';
import { BookOutlined, PlusOutlined, SearchOutlined, TeamOutlined, VideoCameraOutlined } from '@ant-design/icons';
import { platformAdapter } from '@/lib/adapters/platform';
import type { Course } from '@/types/domain';

const { Text, Title } = Typography;

function statusTag(status: string) {
  const color = status === 'active' || status === 'published' ? 'green' : status === 'draft' ? 'default' : 'orange';
  const label = status === 'active' ? '招生中' : status === 'published' ? '已发布' : status === 'draft' ? '草稿' : status;
  return <Tag color={color}>{label}</Tag>;
}

export default function CoursesPage() {
  const [tab, setTab] = useState('offline');
  const [keyword, setKeyword] = useState('');
  const [offlineCourses, setOfflineCourses] = useState<Course[]>([]);
  const [onlineCourses, setOnlineCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    platformAdapter.getCourses()
      .then(data => {
        setOfflineCourses(data.offline);
        setOnlineCourses(data.online);
      })
      .finally(() => setLoading(false));
  }, []);

  const filter = (rows: Course[]) => {
    const q = keyword.trim().toLowerCase();
    return rows.filter(item => !q || [item.name, item.teacher, item.category, item.level].some(value => value.toLowerCase().includes(q)));
  };

  const offlineFiltered = useMemo(() => filter(offlineCourses), [offlineCourses, keyword]);
  const onlineFiltered = useMemo(() => filter(onlineCourses), [onlineCourses, keyword]);
  const totalStudents = offlineCourses.reduce((sum, item) => sum + item.students, 0) + onlineCourses.reduce((sum, item) => sum + item.students, 0);

  const columns = [
    { title: '课程名称', dataIndex: 'name', fixed: 'left' as const, width: 260, render: (value: string) => <Text strong>{value}</Text> },
    { title: '类型', dataIndex: 'category', width: 120, render: (value: string) => <Tag color="magenta">{value}</Tag> },
    { title: '级别', dataIndex: 'level', width: 100 },
    { title: '老师', dataIndex: 'teacher', width: 100 },
    { title: '课次', dataIndex: 'sessions', align: 'right' as const, width: 80 },
    { title: '学员', dataIndex: 'students', align: 'right' as const, width: 80 },
    { title: '价格', dataIndex: 'price', align: 'right' as const, width: 100, render: (value: number) => <Text strong style={{ color: '#F72A8A' }}>¥{Number(value || 0).toLocaleString()}</Text> },
    { title: '开始日期', dataIndex: 'startDate', width: 120 },
    { title: '状态', dataIndex: 'status', width: 100, render: statusTag },
  ];

  if (loading) return <div style={{ padding: 80, textAlign: 'center' }}><Spin size="large" /></div>;

  return (
    <div>
      <div className="page-header">
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col>
            <Title level={2}>课程管理</Title>
            <Text type="secondary">通过课程适配层统一管理线下课程和线上专栏。</Text>
          </Col>
          <Col><Button type="primary" icon={<PlusOutlined />}>新建课程</Button></Col>
        </Row>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}><Card><Statistic title="线下课程" value={offlineCourses.length} prefix={<BookOutlined />} /></Card></Col>
        <Col xs={24} md={8}><Card><Statistic title="线上专栏" value={onlineCourses.length} prefix={<VideoCameraOutlined />} valueStyle={{ color: '#7C3AED' }} /></Card></Col>
        <Col xs={24} md={8}><Card><Statistic title="累计学员" value={totalStudents} prefix={<TeamOutlined />} valueStyle={{ color: '#F72A8A' }} /></Card></Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder="搜索课程名称、老师、类型、级别"
          value={keyword}
          onChange={event => setKeyword(event.target.value)}
          allowClear
        />
      </Card>

      <Card bodyStyle={{ padding: 0 }}>
        <Tabs
          activeKey={tab}
          onChange={setTab}
          style={{ padding: '0 16px' }}
          items={[
            {
              key: 'offline',
              label: `线下课程 ${offlineCourses.length}`,
              children: (
                <Table
                  rowKey="id"
                  columns={columns}
                  dataSource={offlineFiltered}
                  size="middle"
                  scroll={{ x: 1080 }}
                  pagination={{ pageSize: 15, showTotal: total => `共 ${total} 门课程` }}
                  locale={{ emptyText: <Empty description="暂无线下课程数据" /> }}
                />
              ),
            },
            {
              key: 'online',
              label: `线上专栏 ${onlineCourses.length}`,
              children: (
                <Table
                  rowKey="id"
                  columns={columns}
                  dataSource={onlineFiltered}
                  size="middle"
                  scroll={{ x: 1080 }}
                  pagination={{ pageSize: 15, showTotal: total => `共 ${total} 个专栏` }}
                  locale={{ emptyText: <Empty description="暂无线上专栏数据" /> }}
                />
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
