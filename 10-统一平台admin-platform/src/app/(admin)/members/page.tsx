'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar, Button, Card, Col, Empty, Input, Row, Select, Space, Spin, Statistic, Table, Tag, Typography } from 'antd';
import { EyeOutlined, PhoneOutlined, SearchOutlined, UserAddOutlined, UserOutlined } from '@ant-design/icons';
import { platformAdapter } from '@/lib/adapters/platform';
import type { Member } from '@/types/domain';

const { Text, Title } = Typography;

const levelColors: Record<string, string> = {
  高级会员: 'magenta',
  中级会员: 'purple',
  初级学员: 'blue',
  普通会员: 'default',
};

export default function MembersPage() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [level, setLevel] = useState('all');

  useEffect(() => {
    platformAdapter.getMembers()
      .then(setMembers)
      .finally(() => setLoading(false));
  }, []);

  const levels = useMemo(() => ['all', ...Array.from(new Set(members.map(item => item.level).filter(Boolean)))], [members]);
  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return members.filter(item => {
      const matchKeyword = !q || [item.name, item.phone, item.id, item.city].some(value => value.toLowerCase().includes(q));
      const matchLevel = level === 'all' || item.level === level;
      return matchKeyword && matchLevel;
    });
  }, [members, keyword, level]);

  const revenue = members.reduce((sum, item) => sum + item.totalSpent, 0);

  if (loading) return <div style={{ padding: 80, textAlign: 'center' }}><Spin size="large" /></div>;

  return (
    <div>
      <div className="page-header">
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col>
            <Title level={2}>会员中心</Title>
            <Text type="secondary">统一会员档案入口，后续会员 360 从这里进入。</Text>
          </Col>
          <Col><Button type="primary" icon={<UserAddOutlined />}>新建会员</Button></Col>
        </Row>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={6}><Card><Statistic title="会员总数" value={members.length} prefix={<UserOutlined />} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="活跃会员" value={members.filter(item => item.totalSpent > 0).length} valueStyle={{ color: '#22C55E' }} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="累计消费" value={revenue} prefix="¥" valueStyle={{ color: '#F72A8A' }} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="人均消费" value={members.length ? Math.round(revenue / members.length) : 0} prefix="¥" /></Card></Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} md={10}>
            <Input
              prefix={<SearchOutlined />}
              placeholder="搜索姓名、手机号、会员 ID、城市"
              value={keyword}
              onChange={event => setKeyword(event.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} md={6}>
            <Select
              value={level}
              onChange={setLevel}
              style={{ width: '100%' }}
              options={levels.map(item => ({ value: item, label: item === 'all' ? '全部等级' : item }))}
            />
          </Col>
          <Col xs={24} md={8}><Text type="secondary">当前显示 {filtered.length} / {members.length} 位会员</Text></Col>
        </Row>
      </Card>

      <Card bodyStyle={{ padding: 0 }}>
        <Table
          rowKey="id"
          size="middle"
          dataSource={filtered}
          scroll={{ x: 980 }}
          pagination={{ pageSize: 15, showSizeChanger: true, showTotal: total => `共 ${total} 位会员` }}
          locale={{ emptyText: <Empty description="暂无会员数据" /> }}
          columns={[
            {
              title: '会员信息',
              dataIndex: 'name',
              fixed: 'left',
              width: 240,
              render: (_, record) => (
                <Space>
                  <Avatar size={40} style={{ background: 'linear-gradient(135deg,#F72A8A,#7C3AED)' }}>{record.name[0]}</Avatar>
                  <div>
                    <Text strong>{record.name}</Text>
                    <div><Text type="secondary"><PhoneOutlined /> {record.phone || '-'}</Text></div>
                  </div>
                </Space>
              ),
            },
            { title: '等级', dataIndex: 'level', width: 120, render: value => <Tag color={levelColors[value] || 'default'}>{value}</Tag> },
            { title: '城市', dataIndex: 'city', width: 120 },
            { title: '注册日期', dataIndex: 'registerDate', width: 120 },
            { title: '课程数', dataIndex: 'courseCount', align: 'right' as const, width: 90 },
            { title: '累计消费', dataIndex: 'totalSpent', align: 'right' as const, width: 130, render: value => <Text strong style={{ color: '#F72A8A' }}>¥{Number(value || 0).toLocaleString()}</Text> },
            { title: '最近活动', dataIndex: 'lastActiveAt', width: 150 },
            {
              title: '操作',
              fixed: 'right',
              width: 140,
              render: (_, record) => <Button type="link" icon={<EyeOutlined />} onClick={() => router.push(`/members/${record.id}`)}>会员 360</Button>,
            },
          ]}
        />
      </Card>
    </div>
  );
}
