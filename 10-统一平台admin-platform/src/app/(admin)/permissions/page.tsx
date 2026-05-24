'use client';
import { useEffect, useState } from 'react';
import { Badge, Button, Card, Col, Empty, Row, Space, Spin, Statistic, Table, Tabs, Tag, Typography } from 'antd';
import { PlusOutlined, SafetyOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons';
import { platformAdapter } from '@/lib/adapters/platform';
import type { PermissionUser } from '@/types/domain';

const { Text, Title } = Typography;

export default function PermissionsPage() {
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState<PermissionUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    platformAdapter.getPermissionUsers()
      .then(setUsers)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 80, textAlign: 'center' }}><Spin size="large" /></div>;

  return (
    <div>
      <div className="page-header">
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col>
            <Title level={2}>权限管理</Title>
            <Text type="secondary">通过权限适配层读取旧系统用户权限，后续升级为统一 RBAC。</Text>
          </Col>
          <Col><Button type="primary" icon={<PlusOutlined />}>新增用户</Button></Col>
        </Row>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}><Card><Statistic title="后台用户" value={users.length} prefix={<UserOutlined />} /></Card></Col>
        <Col xs={24} md={8}><Card><Statistic title="管理员" value={users.filter(item => item.role === 'admin').length} prefix={<SafetyOutlined />} valueStyle={{ color: '#F72A8A' }} /></Card></Col>
        <Col xs={24} md={8}><Card><Statistic title="普通角色" value={users.filter(item => item.role !== 'admin').length} prefix={<TeamOutlined />} /></Card></Col>
      </Row>

      <Card>
        <Space>
          <Button><SafetyOutlined /> 角色管理</Button>
          <Button><UserOutlined /> 用户管理</Button>
          <Tag color="magenta">下一步：接入 roles / permissions / role_permissions</Tag>
        </Space>
      </Card>

      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          {
            key: 'users',
            label: `用户管理 ${users.length}`,
            children: (
              <Card bodyStyle={{ padding: 0 }}>
                <Table
                  rowKey="id"
                  size="middle"
                  dataSource={users}
                  pagination={{ pageSize: 15 }}
                  locale={{ emptyText: <Empty description="暂无用户数据" /> }}
                  columns={[
                    { title: '用户名', dataIndex: 'username', width: 140 },
                    { title: '姓名', dataIndex: 'name', width: 140 },
                    { title: '角色', dataIndex: 'role', width: 120, render: value => <Tag color={value === 'admin' ? 'red' : 'blue'}>{value}</Tag> },
                    { title: '权限数', dataIndex: 'permissionCount', width: 100, render: value => <Badge count={value} style={{ backgroundColor: '#F72A8A' }} /> },
                    { title: '权限详情', dataIndex: 'permissions', render: values => values.length ? values.map((item: string) => <Tag key={item}>{item}</Tag>) : <Text type="secondary">暂无细分权限</Text> },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: 'roles',
            label: '角色管理',
            children: <Card><Empty description="统一 RBAC 角色表将在下一阶段接入" /></Card>,
          },
        ]}
      />
    </div>
  );
}
